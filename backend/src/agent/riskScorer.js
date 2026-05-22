'use strict';

const Transaction = require('../db/schemas/Transaction');
const config = require('../config');
const logger = require('../utils/logger').forModule('riskScorer');

/**
 * Compute haversine distance between two lat/lng points in km.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute transaction velocity for an account over sliding windows.
 */
async function computeVelocity(accountId, currentTxnId) {
  const now = new Date();

  const [count1min, count5min, count1hr, amtToday] = await Promise.all([
    Transaction.countDocuments({
      accountId,
      txnId: { $ne: currentTxnId },
      createdAt: { $gte: new Date(now - 60 * 1000) },
    }),
    Transaction.countDocuments({
      accountId,
      txnId: { $ne: currentTxnId },
      createdAt: { $gte: new Date(now - 5 * 60 * 1000) },
    }),
    Transaction.countDocuments({
      accountId,
      txnId: { $ne: currentTxnId },
      createdAt: { $gte: new Date(now - 60 * 60 * 1000) },
    }),
    Transaction.aggregate([
      {
        $match: {
          accountId,
          txnId: { $ne: currentTxnId },
          createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).then((r) => r[0]?.total || 0),
  ]);

  // Score velocity (0-100)
  let velocityScore = 0;
  if (count1min >= 5) velocityScore += 50;
  else if (count1min >= 3) velocityScore += 30;
  else if (count1min >= 2) velocityScore += 15;

  if (count5min >= 10) velocityScore += 30;
  else if (count5min >= 5) velocityScore += 15;

  if (count1hr >= 20) velocityScore += 20;

  return {
    count1min,
    count5min,
    count1hr,
    amtToday,
    velocityScore: Math.min(velocityScore, 100),
  };
}

/**
 * Compute geolocation anomaly score.
 */
async function computeGeoAnomaly(txn) {
  if (!txn.geo?.lat || !txn.geo?.lng) {
    return { geoAnomalyScore: 0, distanceKm: 0, isAnomaly: false };
  }

  // Get the last known transaction with geo data for this account
  const lastTxn = await Transaction.findOne({
    accountId: txn.accountId,
    txnId: { $ne: txn.txnId },
    'geo.lat': { $exists: true },
    'geo.lng': { $exists: true },
  })
    .sort({ createdAt: -1 })
    .select('geo createdAt')
    .lean();

  if (!lastTxn) return { geoAnomalyScore: 0, distanceKm: 0, isAnomaly: false };

  const distanceKm = haversineKm(
    lastTxn.geo.lat, lastTxn.geo.lng,
    txn.geo.lat, txn.geo.lng
  );

  // Time since last transaction in hours
  const hoursSinceLast = (new Date() - new Date(lastTxn.createdAt)) / (1000 * 60 * 60);
  // Max feasible travel speed: 900 km/h (plane)
  const maxFeasibleKm = hoursSinceLast * 900;
  const isPhysicallyImpossible = distanceKm > maxFeasibleKm && hoursSinceLast < 2;

  let geoAnomalyScore = 0;
  if (isPhysicallyImpossible) geoAnomalyScore = 95;
  else if (distanceKm > config.agent.geoAnomalyKmThreshold) geoAnomalyScore = 70;
  else if (distanceKm > 500) geoAnomalyScore = 40;
  else if (distanceKm > 100) geoAnomalyScore = 15;

  // IP country vs transaction country mismatch
  if (txn.device?.ipCountry && txn.geo?.country &&
      txn.device.ipCountry.toUpperCase() !== txn.geo.country.toUpperCase()) {
    geoAnomalyScore = Math.min(geoAnomalyScore + 25, 100);
  }

  return {
    geoAnomalyScore: Math.min(geoAnomalyScore, 100),
    distanceKm: Math.round(distanceKm),
    isAnomaly: geoAnomalyScore >= 40,
    isPhysicallyImpossible,
  };
}

/**
 * Compute device trust score.
 */
function computeDeviceTrust(device) {
  if (!device) return { deviceTrustScore: 50, issues: [] };

  let score = 0;
  const issues = [];

  if (!device.isKnownDevice) { score += 20; issues.push('unknown_device'); }
  if (device.isTor) { score += 35; issues.push('tor_exit_node'); }
  if (device.isVpn) { score += 20; issues.push('vpn_detected'); }

  return { deviceTrustScore: Math.min(score, 100), issues };
}

/**
 * Compute behavioral drift score based on historical patterns.
 */
async function computeBehavioralDrift(txn) {
  // Get the last 30 days of account history
  const history = await Transaction.aggregate([
    {
      $match: {
        accountId: txn.accountId,
        txnId: { $ne: txn.txnId },
        status: { $in: ['cleared', 'approved'] },
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    },
    {
      $group: {
        _id: null,
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        stdDev: { $stdDevPop: '$amount' },
        txnCount: { $sum: 1 },
        countries: { $addToSet: '$geo.country' },
        channels: { $addToSet: '$channel' },
      },
    },
  ]);

  if (!history.length) return { behavioralDriftScore: 0, isNewAccount: true };

  const h = history[0];
  let driftScore = 0;

  // Amount drift
  const amountZScore = h.stdDev > 0 ? Math.abs(txn.amount - h.avgAmount) / h.stdDev : 0;
  if (amountZScore > 4) driftScore += 40;
  else if (amountZScore > 2.5) driftScore += 20;
  else if (amountZScore > 1.5) driftScore += 10;

  // New country
  if (txn.geo?.country && !h.countries.includes(txn.geo.country)) {
    driftScore += 20;
  }

  // New channel
  if (txn.channel && !h.channels.includes(txn.channel)) {
    driftScore += 10;
  }

  return {
    behavioralDriftScore: Math.min(driftScore, 100),
    avgAmount: Math.round(h.avgAmount || 0),
    maxAmount: h.maxAmount || 0,
    txnCount: h.txnCount,
    isNewAccount: false,
  };
}

/**
 * Compute merchant risk score.
 */
function computeMerchantRisk(merchant) {
  if (!merchant) return { merchantRiskScore: 0 };

  const HIGH_RISK_MCCS = ['6211', '7995', '6012', '6051']; // Securities, gambling, crypto, forex
  const riskMap = { blocked: 100, high: 70, medium: 35, low: 0 };

  let score = riskMap[merchant.riskTier] || 0;
  if (HIGH_RISK_MCCS.includes(merchant.mcc)) score = Math.min(score + 20, 100);

  return { merchantRiskScore: score };
}

/**
 * Full pre-scoring pass — runs before calling Gemini.
 * Returns structured risk factors that become part of the Gemini prompt.
 */
async function computePreScores(txn) {
  const [velocityData, geoData, behaviorData] = await Promise.all([
    computeVelocity(txn.accountId, txn.txnId),
    computeGeoAnomaly(txn),
    computeBehavioralDrift(txn),
  ]);

  const deviceData = computeDeviceTrust(txn.device);
  const merchantData = computeMerchantRisk(txn.merchant);

  // Quick pre-score to decide if we even need Gemini
  const preScore = Math.round(
    velocityData.velocityScore * 0.25 +
    geoData.geoAnomalyScore * 0.25 +
    deviceData.deviceTrustScore * 0.2 +
    behaviorData.behavioralDriftScore * 0.15 +
    merchantData.merchantRiskScore * 0.15
  );

  logger.debug({ txnId: txn.txnId, preScore }, 'Pre-scores computed');

  return {
    preScore,
    velocityData,
    geoData,
    deviceData,
    merchantData,
    behaviorData,
  };
}

module.exports = { computePreScores, computeVelocity, computeGeoAnomaly };
