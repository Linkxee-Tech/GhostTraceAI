#!/usr/bin/env node
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../backend/src/db/schemas/Transaction');
const config = require('../backend/src/config');
const logger = require('../backend/src/utils/logger').forModule('seeder');

const MERCHANTS = [
  { name: 'Amazon Prime',    category: 'retail',              country: 'US', riskTier: 'low'    },
  { name: 'Netflix',         category: 'entertainment',       country: 'US', riskTier: 'low'    },
  { name: 'Spotify',         category: 'entertainment',       country: 'SE', riskTier: 'low'    },
  { name: 'Apple Store',     category: 'electronics',         country: 'US', riskTier: 'low'    },
  { name: 'Crypto Exchange', category: 'cryptocurrency',      country: 'UA', riskTier: 'high'   },
  { name: 'Forex Broker',    category: 'financial_services',  country: 'RU', riskTier: 'high'   },
  { name: 'Wire Transfer',   category: 'financial_services',  country: 'GB', riskTier: 'medium' },
  { name: 'Betting Site',    category: 'gambling',            country: 'GI', riskTier: 'high'   },
  { name: 'Supermarket',     category: 'grocery',             country: 'NG', riskTier: 'low'    },
  { name: 'Local Hospital',  category: 'healthcare',          country: 'NG', riskTier: 'low'    },
];

const ACCOUNTS = ['ACC-001', 'ACC-002', 'ACC-003', 'ACC-004', 'ACC-005',
                  'ACC-006', 'ACC-007', 'ACC-008', 'ACC-009', 'ACC-010'];

function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildTransaction(isFraud = false) {
  const merchant = randomItem(MERCHANTS);
  const accountId = randomItem(ACCOUNTS);
  const daysAgo = randomInt(0, 30);
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000 - randomInt(0, 86_400_000));

  if (isFraud) {
    const fraudScore = randomInt(75, 99);
    return {
      txnId:     `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
      accountId,
      amount:    randomFloat(1000, 50000),
      currency:  'USD',
      type:      randomItem(['wire', 'transfer']),
      channel:   'api',
      status:    randomItem(['blocked', 'frozen', 'flagged']),
      merchant:  { ...merchant, country: randomItem(['RU', 'UA', 'XX', 'CN']), riskTier: 'high' },
      device:    { isKnownDevice: false, isTor: Math.random() > 0.5, isVpn: true, ipCountry: 'RU' },
      geo:       { country: 'RU', city: 'Moscow', lat: 55.75, lng: 37.61, distanceFromLastKm: randomInt(3000, 10000), isAnomaly: true },
      agentProcessed: true,
      agentProcessedAt: createdAt,
      fraudScore,
      fraudConfidence: parseFloat((0.8 + Math.random() * 0.19).toFixed(3)),
      isFraud:   true,
      fraudReasons: ['velocity_spike', 'geo_anomaly', 'vpn_detected'],
      agentAction: 'block',
      agentActionAt: createdAt,
      velocityCount1min: randomInt(3, 8),
      createdAt,
      updatedAt: createdAt,
    };
  }

  return {
    txnId:     `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
    accountId,
    amount:    randomFloat(10, 2000),
    currency:  'USD',
    type:      randomItem(['purchase', 'debit']),
    channel:   randomItem(['online', 'pos', 'mobile']),
    status:    'cleared',
    merchant,
    device:    { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
    geo:       { country: 'NG', city: 'Lagos', lat: 6.52, lng: 3.38, distanceFromLastKm: randomInt(0, 20), isAnomaly: false },
    agentProcessed: true,
    agentProcessedAt: createdAt,
    fraudScore:  randomInt(1, 20),
    fraudConfidence: 0.97,
    isFraud:   false,
    fraudReasons: [],
    agentAction: 'clear',
    agentActionAt: createdAt,
    velocityCount1min: 0,
    createdAt,
    updatedAt: createdAt,
  };
}

async function seed() {
  logger.info('Connecting to MongoDB…');
  await mongoose.connect(config.mongodb.uri, { dbName: config.mongodb.dbName });

  logger.info('Clearing existing transactions…');
  await Transaction.deleteMany({});

  const transactions = [];

  // 80 normal + 20 fraud = 100 total
  for (let i = 0; i < 80; i++) transactions.push(buildTransaction(false));
  for (let i = 0; i < 20; i++) transactions.push(buildTransaction(true));

  // Shuffle
  transactions.sort(() => Math.random() - 0.5);

  await Transaction.insertMany(transactions, { ordered: false });
  logger.info({ count: transactions.length }, 'Seed data inserted');

  await mongoose.disconnect();
  logger.info('Done');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
