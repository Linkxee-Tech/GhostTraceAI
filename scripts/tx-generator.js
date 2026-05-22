'use strict';

/*
 Transaction Generator
 - Inserts synthetic transactions into the `transactions` collection
 - Runs every 1-3 seconds (randomized) by default
 - Simulates occasional fraud patterns (large transfer, velocity, foreign login, new device, repeated failures)

 Usage:
   NODE_ENV=development MONGODB_URI="mongodb://..." node scripts/tx-generator.js --rate=1500 --fraudRate=0.12
*/

const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const argv = yargs(hideBin(process.argv))
  .option('rate', { type: 'number', description: 'Average interval ms between transactions', default: 2000 })
  .option('jitter', { type: 'number', description: 'Max jitter ms (+/-)', default: 1000 })
  .option('fraudRate', { type: 'number', description: 'Fraction of transactions that include a fraud pattern', default: 0.12 })
  .option('burstChance', { type: 'number', description: 'Chance of velocity burst', default: 0.05 })
  .argv;

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ghosttrace';
const DB_NAME = process.env.MONGODB_DB_NAME || 'ghosttrace';

const Transaction = require('../backend/src/db/schemas/Transaction');

const ACCOUNTS = Array.from({ length: 30 }, (_, i) => `ACC-${String(i + 1).padStart(3, '0')}`);
const MERCHANTS = [
  { name: 'Acme Supplies', category: 'office' },
  { name: 'Speedy Foods', category: 'food' },
  { name: 'Global Bank XFER', category: 'bank' },
  { name: 'Gadget World', category: 'electronics' },
  { name: 'TravelNow', category: 'travel' },
];
const COUNTRIES = ['US', 'GB', 'NG', 'RU', 'UA', 'IN', 'CN', 'BR', 'DE', 'FR'];
const CHANNELS = ['online', 'pos', 'atm', 'mobile', 'api', 'wire'];

let running = true;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomAmount() {
  const r = Math.random();
  if (r < 0.75) return parseFloat((Math.random() * 200).toFixed(2));
  if (r < 0.95) return parseFloat((200 + Math.random() * 1500).toFixed(2));
  return parseFloat((2000 + Math.random() * 20000).toFixed(2));
}

function makeBaseTransaction(overrides = {}) {
  const accountId = overrides.accountId || pick(ACCOUNTS);
  const txn = {
    txnId: `TXN-${uuidv4().slice(0, 8).toUpperCase()}`,
    accountId,
    userId: `USR-${accountId.split('-')[1]}`,
    amount: overrides.amount ?? randomAmount(),
    currency: 'USD',
    type: pick(['purchase', 'transfer', 'withdrawal', 'payment']),
    channel: overrides.channel || pick(CHANNELS),
    merchant: overrides.merchant || pick(MERCHANTS),
    device: overrides.device || {
      fingerprint: `DEV-${uuidv4().slice(0, 8)}`,
      ipCountry: overrides.device?.ipCountry || geoLoc && geoLoc.country || geoCountry,
      isTor: false,
      isVpn: false,
      isKnownDevice: true,
    },
    geo: overrides.geo || {
      country: geoCountry,
      city: geoLoc.city,
      lat: geoLoc.lat,
      lng: geoLoc.lng,
      distanceFromLastKm,
    },
    rawPayload: overrides.rawPayload || {},
    status: overrides.status || 'pending',
    tags: overrides.tags || [],

    // A small sample of realistic cities with coordinates for each country
    const LOCATIONS = {
      US: [
        { city: 'New York', lat: 40.7128, lng: -74.0060 },
        { city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
        { city: 'Chicago', lat: 41.8781, lng: -87.6298 },
      ],
      GB: [
        { city: 'London', lat: 51.5074, lng: -0.1278 },
        { city: 'Manchester', lat: 53.4808, lng: -2.2426 },
      ],
      NG: [
        { city: 'Lagos', lat: 6.5244, lng: 3.3792 },
        { city: 'Abuja', lat: 9.0765, lng: 7.3986 },
      ],
      RU: [
        { city: 'Moscow', lat: 55.7558, lng: 37.6173 },
        { city: 'Saint Petersburg', lat: 59.9311, lng: 30.3609 },
      ],
      UA: [
        { city: 'Kyiv', lat: 50.4501, lng: 30.5234 },
        { city: 'Lviv', lat: 49.8397, lng: 24.0297 },
      ],
      IN: [
        { city: 'Mumbai', lat: 19.0760, lng: 72.8777 },
        { city: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
      ],
      CN: [
        { city: 'Beijing', lat: 39.9042, lng: 116.4074 },
        { city: 'Shanghai', lat: 31.2304, lng: 121.4737 },
      ],
      BR: [
        { city: 'Sao Paulo', lat: -23.5505, lng: -46.6333 },
        { city: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
      ],
      DE: [
        { city: 'Berlin', lat: 52.5200, lng: 13.4050 },
        { city: 'Munich', lat: 48.1351, lng: 11.5820 },
      ],
      FR: [
        { city: 'Paris', lat: 48.8566, lng: 2.3522 },
        { city: 'Lyon', lat: 45.7640, lng: 4.8357 },
      ],
    };

    // Track last known location per account to compute realistic distances
    const lastLocationByAccount = {};

    function deg2rad(deg) {
      return deg * (Math.PI / 180);
    }

    function haversineKm(a, b) {
      if (!a || !b) return 0;
      const R = 6371; // km
      const dLat = deg2rad(b.lat - a.lat);
      const dLon = deg2rad(b.lng - a.lng);
      const lat1 = deg2rad(a.lat);
      const lat2 = deg2rad(b.lat);

      const sinDlat = Math.sin(dLat / 2) * Math.sin(dLat / 2);
      const sinDlon = Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const aHarv = sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon;
      const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
      return R * c;
    }

    function getRandomLocationForCountry(country) {
      const list = LOCATIONS[country] || LOCATIONS.US;
      return pick(list);
    }
          txn.geo.country = txn.device.ipCountry;
          txn.tags.push('foreign_login_high_value');
          break;
        case 4: // new device + unusual location
          txn = makeBaseTransaction({ amount: parseFloat((100 + Math.random() * 900).toFixed(2)), type: 'purchase' });
          txn.device = { fingerprint: `DEV-${uuidv4().slice(0, 8)}`, ipCountry: pick(COUNTRIES), isKnownDevice: false, isTor: false, isVpn: false };
          txn.geo.country = pick(COUNTRIES.filter((c) => c !== txn.device.ipCountry));
          txn.tags.push('new_device_unusual_location');
          break;
        case 5: // repeated failed transactions
          {
            const acc = pick(ACCOUNTS);
            const count = randInt(3, 6);
            console.log('SIMULATE repeated failures for', acc, 'count=', count);
            for (let i = 0; i < count - 1; i++) {
              const t = makeBaseTransaction({ accountId: acc, amount: Math.random() * 50 + 1 });
              t.status = 'failed';
              t.rawPayload = { failureReason: 'insufficient_funds' };
              t.tags.push('failed_attempt');
              await insertTransaction(t);
              await new Promise((r) => setTimeout(r, randInt(200, 600)));
            }
            // final successful high-value attempt
            const final = makeBaseTransaction({ accountId: acc, amount: parseFloat((1000 + Math.random() * 5000).toFixed(2)) });
            final.tags.push('failed_then_success');
            await insertTransaction(final);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
        default:
          txn = makeBaseTransaction();
      }
    } else {
      txn = makeBaseTransaction();
    }

    await insertTransaction(txn);

    await new Promise((r) => setTimeout(r, delay));
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down generator...');
  running = false;
  try {
    await mongoose.disconnect();
  } catch (e) {}
  process.exit(0);
});

if (require.main === module) {
  runGenerator().catch((err) => {
    console.error('Generator error', err);
    process.exit(1);
  });
}
