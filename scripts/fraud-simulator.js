#!/usr/bin/env node
'use strict';

/**
 * GhostTrace AI — Fraud Simulator
 *
 * Streams synthetic transactions to the backend API to simulate
 * a live financial data feed. Use this for demos and load testing.
 *
 * Usage:
 *   node scripts/fraud-simulator.js [--rate=2] [--fraud-rate=0.2] [--url=http://localhost:3001]
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace('--', '').split('=');
    return [k, v];
  })
);

const API_URL    = args.url        || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const RATE_HZ    = parseFloat(args.rate       || '1');       // transactions per second
const FRAUD_RATE = parseFloat(args['fraud-rate'] || '0.15'); // 15% fraud by default
const API_KEY    = args['api-key'] || process.env.SIMULATOR_API_KEY || '';
const INTERVAL_MS = Math.round(1000 / RATE_HZ);

const COLORS = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

const c = (color, text) => `${COLORS[color]}${text}${COLORS.reset}`;

// ── Transaction factories ─────────────────────────────────────
const LEGIT_MERCHANTS = [
  { name: 'Amazon',       category: 'retail',         country: 'US', riskTier: 'low'    },
  { name: 'Netflix',      category: 'entertainment',  country: 'US', riskTier: 'low'    },
  { name: 'Shoprite',     category: 'grocery',        country: 'NG', riskTier: 'low'    },
  { name: 'Apple Store',  category: 'electronics',    country: 'US', riskTier: 'low'    },
  { name: 'Uber',         category: 'transportation', country: 'NG', riskTier: 'low'    },
  { name: 'MTN Nigeria',  category: 'telecom',        country: 'NG', riskTier: 'low'    },
  { name: 'PayPal',       category: 'financial',      country: 'GB', riskTier: 'medium' },
];

const FRAUD_MERCHANTS = [
  { name: 'Crypto Exchange',  category: 'cryptocurrency',     country: 'UA', riskTier: 'high' },
  { name: 'Forex Broker',     category: 'financial_services', country: 'RU', riskTier: 'high' },
  { name: 'Unknown Entity',   category: 'other',              country: 'XX', riskTier: 'high' },
  { name: 'Offshore Casino',  category: 'gambling',           country: 'GI', riskTier: 'high' },
];

const ACCOUNTS = Array.from({ length: 20 }, (_, i) =>
  `ACC-${String(i + 1).padStart(4, '0')}`
);

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return +(Math.random() * (max - min) + min).toFixed(2); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildLegitTransaction() {
  return {
    accountId: pick(ACCOUNTS),
    amount:    rand(5, 1500),
    currency:  'USD',
    type:      pick(['purchase', 'debit']),
    channel:   pick(['online', 'pos', 'mobile']),
    merchant:  pick(LEGIT_MERCHANTS),
    device: {
      fingerprint:   `DEV-${uuidv4().slice(0, 8)}`,
      ipAddress:     `197.${randInt(1,255)}.${randInt(1,255)}.${randInt(1,254)}`,
      ipCountry:     'NG',
      userAgent:     'Mozilla/5.0 (iPhone; CPU iPhone OS 17)',
      isKnownDevice: true,
      isTor:         false,
      isVpn:         false,
    },
    geo: {
      country:             'Nigeria',
      city:                pick(['Lagos', 'Abuja', 'Port Harcourt', 'Kano']),
      lat:                 6.52 + rand(-0.5, 0.5),
      lng:                 3.38 + rand(-0.5, 0.5),
      distanceFromLastKm:  rand(0, 50),
      isAnomaly:           false,
    },
  };
}

function buildFraudTransaction(type = 'geo_anomaly') {
  const base = {
    accountId: pick(ACCOUNTS),
    currency:  'USD',
    type:      pick(['wire', 'transfer', 'purchase']),
    channel:   'api',
    merchant:  pick(FRAUD_MERCHANTS),
  };

  switch (type) {
    case 'geo_anomaly':
      return {
        ...base,
        amount: rand(5000, 50000),
        device: { fingerprint: `NEW-${uuidv4().slice(0, 8)}`, ipAddress: `185.${randInt(1,255)}.${randInt(1,255)}.${randInt(1,254)}`, ipCountry: 'RU', isKnownDevice: false, isTor: false, isVpn: true },
        geo:    { country: 'Russia', city: 'Moscow', lat: 55.75, lng: 37.61, distanceFromLastKm: rand(5000, 10000), isAnomaly: true },
      };

    case 'velocity':
      return {
        ...base,
        amount: rand(1, 50),  // Card testing — small amounts
        device: { fingerprint: `BOT-${uuidv4().slice(0, 8)}`, ipAddress: `10.${randInt(1,255)}.${randInt(1,255)}.${randInt(1,254)}`, ipCountry: 'XX', isKnownDevice: false, isTor: false, isVpn: false },
        geo:    { country: 'Unknown', city: 'Unknown', lat: 0, lng: 0, distanceFromLastKm: 0, isAnomaly: false },
      };

    case 'tor':
      return {
        ...base,
        amount: rand(500, 8000),
        device: { fingerprint: `TOR-${uuidv4().slice(0, 8)}`, ipAddress: `198.${randInt(1,255)}.${randInt(1,255)}.${randInt(1,254)}`, ipCountry: 'XX', isKnownDevice: false, isTor: true, isVpn: false },
        geo:    { country: 'Ukraine', city: 'Kyiv', lat: 50.45, lng: 30.52, distanceFromLastKm: rand(3000, 8000), isAnomaly: true },
      };

    default:
      return buildFraudTransaction('geo_anomaly');
  }
}

// ── HTTP sender ───────────────────────────────────────────────
let sent = 0; let fraudSent = 0; let errors = 0;

async function sendTransaction(payload) {
  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  };

  const res = await fetch(`${API_URL}/api/v1/transactions`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
  }

  return res.json();
}

// ── Main loop ─────────────────────────────────────────────────
function printStatus() {
  process.stdout.write(
    `\r${c('gray', '[')}${c('cyan', new Date().toLocaleTimeString())}${c('gray', ']')} ` +
    `Sent: ${c('green', sent)} | Fraud: ${c('red', fraudSent)} | Errors: ${c('yellow', errors)} | ` +
    `Rate: ${c('blue', RATE_HZ + '/s')}   `
  );
}

async function tick() {
  const isFraud = Math.random() < FRAUD_RATE;
  const fraudType = pick(['geo_anomaly', 'velocity', 'tor']);
  const payload   = isFraud ? buildFraudTransaction(fraudType) : buildLegitTransaction();

  try {
    const result = await sendTransaction(payload);
    sent++;
    if (isFraud) fraudSent++;
    printStatus();
  } catch (err) {
    errors++;
    if (process.env.DEBUG) {
      console.error(c('red', `\n[ERROR] ${err.message}`));
    }
    printStatus();
  }
}

async function main() {
  console.log(c('cyan', '\n🔍 GhostTrace AI — Fraud Simulator'));
  console.log(c('gray', `   API:        ${API_URL}`));
  console.log(c('gray', `   Rate:        ${RATE_HZ} tx/s`));
  console.log(c('gray', `   Fraud rate:  ${(FRAUD_RATE * 100).toFixed(0)}%`));
  console.log(c('gray', `   Auth:        ${API_KEY ? 'API key set' : 'none (bypass mode)'}`));
  console.log(c('yellow', '\n   Press Ctrl+C to stop\n'));

  // Verify backend is reachable
  try {
    const res = await fetch(`${API_URL}/api/v1/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log(c('green', '   ✓ Backend reachable\n'));
  } catch (err) {
    console.error(c('red', `   ✗ Backend not reachable: ${err.message}`));
    console.error(c('yellow', '   Start the backend first: npm run dev --workspace=backend\n'));
    process.exit(1);
  }

  // Run at configured rate
  const interval = setInterval(tick, INTERVAL_MS);

  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(c('cyan', `\n\n   Simulator stopped. Sent: ${sent} tx (${fraudSent} fraud, ${errors} errors)\n`));
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
