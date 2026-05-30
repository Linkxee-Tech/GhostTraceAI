'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Transaction = require('../db/schemas/Transaction');
const IngestionEvent = require('../db/schemas/IngestionEvent');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function deriveTxnId(transactionId) {
  if (transactionId && String(transactionId).trim()) return String(transactionId).trim();
  return `TXN-${uuidv4().slice(0, 8).toUpperCase()}`;
}

function normalizeTransactionEvent(payload = {}, defaults = {}) {
  const timestamp = payload.timestamp ? new Date(payload.timestamp) : new Date();
  return {
    txnId: deriveTxnId(payload.transactionId),
    userId: payload.userId || null,
    accountId: payload.accountId,
    amount: Number(payload.amount),
    currency: (payload.currency || 'USD').toUpperCase(),
    type: payload.type || 'transfer',
    channel: payload.channel || defaults.channel || 'api',
    paymentMethod: payload.paymentMethod || 'other',
    sourceSystem: payload.sourceSystem || defaults.sourceSystem || 'external_api',
    merchant: payload.merchant || null,
    device: {
      fingerprint: payload.device?.fingerprint,
      ipAddress: payload.ipAddress || payload.device?.ipAddress,
      ipCountry: payload.device?.ipCountry || payload.location?.country,
      ipCity: payload.device?.ipCity || payload.location?.city,
      userAgent: payload.device?.userAgent || defaults.userAgent,
      isTor: Boolean(payload.device?.isTor),
      isVpn: Boolean(payload.device?.isVpn),
      isKnownDevice: Boolean(payload.device?.isKnownDevice),
    },
    geo: payload.location
      ? {
          country: payload.location.country,
          city: payload.location.city,
          lat: payload.location.lat,
          lng: payload.location.lng,
        }
      : null,
    metadata: payload.metadata || {},
    riskFlags: Array.isArray(payload.riskFlags) ? payload.riskFlags : [],
    rawPayload: payload,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'pending',
  };
}

function validateCanonicalEvent(event) {
  if (!event.accountId || typeof event.accountId !== 'string') {
    throw new Error('Normalized event missing accountId');
  }
  if (!Number.isFinite(event.amount) || event.amount <= 0) {
    throw new Error('Normalized event has invalid amount');
  }
  if (!event.currency || typeof event.currency !== 'string' || event.currency.length !== 3) {
    throw new Error('Normalized event has invalid currency');
  }
  if (!event.sourceSystem || typeof event.sourceSystem !== 'string') {
    throw new Error('Normalized event missing sourceSystem');
  }
}

async function ingestEvent({ payload, sourceType, sourceSystem, externalEventId, requestMeta }) {
  const ingestId = `ING-${uuidv4().slice(0, 10).toUpperCase()}`;
  const payloadHash = sha256(JSON.stringify(payload || {}));
  let normalized = null;
  let eventId = externalEventId || payload?.eventId;
  try {
    normalized = normalizeTransactionEvent(payload, {
      sourceSystem,
      channel: payload.channel,
      userAgent: requestMeta?.userAgent,
    });
    validateCanonicalEvent(normalized);
    eventId = eventId || normalized.txnId;

    const existing = await IngestionEvent.findOne({ sourceSystem, externalEventId: eventId }).lean();
    if (existing) {
      return { status: 'duplicate', normalizedTxnId: existing.normalizedTxnId, ingestId: existing.ingestId };
    }

    const txn = await Transaction.findOneAndUpdate(
      { txnId: normalized.txnId },
      { $setOnInsert: normalized },
      { new: true, upsert: true }
    );

    await IngestionEvent.create({
      ingestId,
      sourceSystem,
      sourceType,
      externalEventId: eventId,
      externalTransactionId: payload.transactionId || normalized.txnId,
      payloadHash,
      processingStatus: 'accepted',
      normalizedTxnId: txn.txnId,
      channel: normalized.channel,
      requestMeta,
      processedAt: new Date(),
      rawPayload: payload,
    });

    return { status: 'accepted', normalizedTxnId: txn.txnId, ingestId };
  } catch (err) {
    await IngestionEvent.create({
      ingestId,
      sourceSystem: sourceSystem || 'unknown',
      sourceType,
      externalEventId: eventId || `invalid-${ingestId}`,
      externalTransactionId: payload?.transactionId,
      payloadHash,
      processingStatus: 'rejected',
      rejectionReason: err.message,
      requestMeta,
      processedAt: new Date(),
      rawPayload: payload,
    }).catch((createErr) => {
      // Log but don't mask the original error which is re-thrown
      const logger = require('../utils/logger').forModule('transactionIngestion');
      logger.warn({ createErr }, 'Failed to write rejected ingestion event');
    });
    throw err;
  }
}

module.exports = { normalizeTransactionEvent, ingestEvent };
