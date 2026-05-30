'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const { getDb } = require('../db/connection');
const Transaction = require('../db/schemas/Transaction');
const logger = require('../utils/logger').forModule('vector');

let geminiClient = null;
let embeddingModel = null;

function getClient() {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      logger.warn('GOOGLE_API_KEY not set — vector embeddings disabled');
      return null;
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

function getEmbeddingModel() {
  if (!embeddingModel) {
    const client = getClient();
    if (!client) return null;
    embeddingModel = client.getGenerativeModel({
      model: config.gemini.embeddingModel,
    });
  }
  return embeddingModel;
}

function sanitizeText(value) {
  if (!value) return '';
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/[`"'<>]/g, '')
    .trim()
    .slice(0, 1500);
}

function buildTransactionEmbeddingText(txn) {
  const fields = [
    `Transaction ${txn.txnId}`,
    `Account ${txn.accountId}`,
    `Amount ${txn.amount} ${txn.currency}`,
    `Type ${txn.type}`,
    `Channel ${txn.channel}`,
  ];

  if (txn.merchant) {
    fields.push(`Merchant ${txn.merchant.name || ''}`);
    fields.push(`Category ${txn.merchant.category || ''}`);
    fields.push(`Risk ${txn.merchant.riskTier || ''}`);
    fields.push(`Country ${txn.merchant.country || ''}`);
  }

  if (txn.geo) {
    fields.push(`Geo ${txn.geo.city || ''} ${txn.geo.country || ''}`);
    fields.push(`Distance ${txn.geo.distanceFromLastKm || 0} km`);
    fields.push(`Anomaly ${txn.geo.isAnomaly ? 'yes' : 'no'}`);
  }

  if (txn.device) {
    fields.push(`Device known:${txn.device.isKnownDevice ? 'yes' : 'no'}`);
    fields.push(`TOR:${txn.device.isTor ? 'yes' : 'no'}`);
    fields.push(`VPN:${txn.device.isVpn ? 'yes' : 'no'}`);
    fields.push(`IP country ${txn.device.ipCountry || ''}`);
  }

  return sanitizeText(fields.filter(Boolean).join('. '));
}

function normalizeEmbeddingResponse(response) {
  const candidate = response?.data?.[0] || response;
  if (Array.isArray(candidate?.embedding)) return candidate.embedding;
  if (Array.isArray(response?.embedding)) return response.embedding;
  return null;
}

function dotProduct(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  return a.reduce((sum, value, index) => sum + value * (b[index] || 0), 0);
}

function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

async function generateEmbedding(text) {
  const model = getEmbeddingModel();
  if (!model) {
    // No model available — return null to let callers handle fallback
    return null;
  }
  const raw = await model.embedContent({ content: sanitizeText(text) });
  const embedding = normalizeEmbeddingResponse(raw);
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Failed to generate embedding from Gemini response');
  }
  return embedding;
}

async function generateTransactionEmbedding(txn) {
  const text = buildTransactionEmbeddingText(txn);
  return generateEmbedding(text);
}

async function generateTextEmbedding(query) {
  return generateEmbedding(String(query));
}

async function fallbackVectorSearch(queryVector, limit, filter = {}) {
  const filterQuery = { ...filter, aiVector: { $exists: true, $ne: [] } };
  const docs = await Transaction.find(filterQuery).lean().limit(200);
  const scored = docs
    .map((doc) => ({
      similarityScore: cosineSimilarity(queryVector, doc.aiVector || []),
      doc,
    }))
    .filter((item) => item.similarityScore > 0)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit)
    .map((item) => ({ ...item.doc, similarityScore: item.similarityScore }));

  return scored;
}

async function searchSimilarTransactions({ queryVector, limit = 5, accountId, excludeTxnId }) {
  const collection = getDb().collection('transactions');
  const matchFilter = {};
  if (accountId) matchFilter.accountId = accountId;
  if (excludeTxnId) matchFilter.txnId = { $ne: excludeTxnId };

  try {
    const pipeline = [
      {
        $search: {
          knnBeta: {
            vector: queryVector,
            path: 'aiVector',
            k: limit,
          },
        },
      },
    ];

    if (Object.keys(matchFilter).length) {
      pipeline.push({ $match: matchFilter });
    }

    pipeline.push({
      $project: {
        txnId: 1,
        accountId: 1,
        amount: 1,
        currency: 1,
        status: 1,
        fraudScore: 1,
        agentAction: 1,
        merchant: 1,
        geo: 1,
        device: 1,
        similarityScore: { $meta: 'searchScore' },
      },
    });
    pipeline.push({ $limit: limit });

    const results = await collection.aggregate(pipeline).toArray();
    if (results.length) return results;
  } catch (err) {
    logger.warn({ err }, 'Atlas vector search unavailable, falling back to local similarity');
  }

  return fallbackVectorSearch(queryVector, limit, matchFilter);
}

async function persistTransactionEmbedding(txn) {
  if (txn.aiVector && Array.isArray(txn.aiVector) && txn.aiVector.length) {
    return txn.aiVector;
  }
  try {
    const aiVector = await generateTransactionEmbedding(txn);
    if (!aiVector) {
      logger.warn({ txnId: txn.txnId }, 'No embedding generated — skipping persist');
      return null;
    }
    await Transaction.updateOne({ txnId: txn.txnId }, { $set: { aiVector } });
    return aiVector;
  } catch (err) {
    logger.error({ err, txnId: txn.txnId }, 'Failed to persist transaction embedding');
    return null;
  }
}

module.exports = {
  generateTransactionEmbedding,
  generateTextEmbedding,
  persistTransactionEmbedding,
  searchSimilarTransactions,
};
