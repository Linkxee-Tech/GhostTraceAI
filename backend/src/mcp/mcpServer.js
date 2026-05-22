'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z } = require('zod');
const Transaction = require('../db/schemas/Transaction');
const { FraudAlert, AuditLog, AgentAction } = require('../db/schemas/Fraud');
const vectorService = require('../services/vectorService');
const config = require('../config');
const logger = require('../utils/logger').forModule('mcpServer');

/**
 * GhostTrace MCP Server
 *
 * Exposes MongoDB collections as tools that the Gemini agent
 * can call via the Model Context Protocol. Each tool returns
 * structured JSON the agent uses for fraud reasoning.
 */
const server = new McpServer({
  name:    'ghosttrace-mongodb',
  version: '1.0.0',
});

// ── Tool: get_transaction ─────────────────────────────────────
server.tool(
  'get_transaction',
  'Retrieve a single transaction by txnId for fraud analysis',
  { txnId: z.string().describe('The transaction ID to retrieve') },
  async ({ txnId }) => {
    const txn = await Transaction.findOne({ txnId })
      .select('-rawPayload -__v')
      .lean();

    if (!txn) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Transaction not found' }) }] };
    }

    // Mask IP address
    if (txn.device?.ipAddress) txn.device.ipAddress = txn.device.ipAddress.replace(/\d+$/, 'xxx');

    return { content: [{ type: 'text', text: JSON.stringify(txn) }] };
  }
);

// ── Tool: get_account_history ─────────────────────────────────
server.tool(
  'get_account_history',
  'Get recent transaction history for an account to detect behavioral patterns',
  {
    accountId: z.string().describe('The account ID'),
    days:      z.number().min(1).max(90).optional().describe('Number of days to look back (default 30)'),
    limit:     z.number().min(1).max(100).optional().describe('Max transactions to return (default 20)'),
  },
  async ({ accountId, days = 30, limit = 20 }) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const transactions = await Transaction.find({
      accountId,
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('txnId amount currency type status fraudScore merchant geo device createdAt')
      .lean();

    const stats = await Transaction.aggregate([
      { $match: { accountId, createdAt: { $gte: since } } },
      {
        $group: {
          _id:       null,
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          txnCount:  { $sum: 1 },
          fraudCount:{ $sum: { $cond: [{ $eq: ['$isFraud', true] }, 1, 0] } },
          countries: { $addToSet: '$geo.country' },
        },
      },
    ]);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ transactions, stats: stats[0] || {}, accountId, days }),
      }],
    };
  }
);

// ── Tool: get_velocity_data ───────────────────────────────────
server.tool(
  'get_velocity_data',
  'Get transaction velocity counts for an account over sliding windows',
  {
    accountId: z.string(),
    txnId:     z.string().optional().describe('Exclude this txnId from counts'),
  },
  async ({ accountId, txnId }) => {
    const now = Date.now();
    const exclude = txnId ? { txnId: { $ne: txnId } } : {};

    const [c1m, c5m, c1h, amtToday] = await Promise.all([
      Transaction.countDocuments({ accountId, ...exclude, createdAt: { $gte: new Date(now - 60_000) } }),
      Transaction.countDocuments({ accountId, ...exclude, createdAt: { $gte: new Date(now - 300_000) } }),
      Transaction.countDocuments({ accountId, ...exclude, createdAt: { $gte: new Date(now - 3_600_000) } }),
      Transaction.aggregate([
        { $match: { accountId, ...exclude, createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).then((r) => r[0]?.total || 0),
    ]);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ count1min: c1m, count5min: c5m, count1hr: c1h, amountToday: amtToday }),
      }],
    };
  }
);

// ── Tool: get_fraud_alerts ────────────────────────────────────
server.tool(
  'get_fraud_alerts',
  'Get recent open fraud alerts, optionally filtered by account',
  {
    accountId: z.string().optional(),
    limit:     z.number().min(1).max(50).optional(),
  },
  async ({ accountId, limit = 10 }) => {
    const filter = { status: { $in: ['open', 'acknowledged'] } };
    if (accountId) filter.accountId = accountId;

    const alerts = await FraudAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('alertId txnId accountId severity fraudScore triggerReasons agentAction createdAt')
      .lean();

    return { content: [{ type: 'text', text: JSON.stringify(alerts) }] };
  }
);

// ── Tool: get_audit_trail ─────────────────────────────────────
server.tool(
  'get_audit_trail',
  'Retrieve the full audit trail for a specific transaction',
  { txnId: z.string() },
  async ({ txnId }) => {
    const logs = await AuditLog.find({ txnId })
      .sort({ createdAt: 1 })
      .select('auditId eventType action actorType details success latencyMs createdAt')
      .lean();

    return { content: [{ type: 'text', text: JSON.stringify(logs) }] };
  }
);

// ── Tool: get_similar_fraud_patterns ─────────────────────────
server.tool(
  'get_similar_fraud_patterns',
  'Find historical transactions with similar fraud patterns for context',
  {
    merchantCategory: z.string().optional(),
    geoCountry:       z.string().optional(),
    minScore:         z.number().min(0).max(100).optional(),
    limit:            z.number().min(1).max(20).optional(),
  },
  async ({ merchantCategory, geoCountry, minScore = 75, limit = 5 }) => {
    const filter = {
      isFraud:    true,
      fraudScore: { $gte: minScore },
    };
    if (merchantCategory) filter['merchant.category'] = merchantCategory;
    if (geoCountry)       filter['geo.country']       = geoCountry;

    const similar = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('txnId amount fraudScore fraudReasons merchant geo agentAction createdAt')
      .lean();

    return { content: [{ type: 'text', text: JSON.stringify(similar) }] };
  }
);

// ── Tool: write_agent_finding ─────────────────────────────────
server.tool(
  'write_agent_finding',
  'Record an agent finding or intermediate reasoning step in the audit log',
  {
    txnId:     z.string(),
    accountId: z.string(),
    finding:   z.string().describe('The finding or reasoning step to record'),
    score:     z.number().min(0).max(100).optional(),
  },
  async ({ txnId, accountId, finding, score }) => {
    await AuditLog.create({
      auditId:   require('uuid').v4(),
      eventType: 'agent_reasoning_complete',
      txnId,
      accountId,
      actorType: 'agent',
      action:    'mcp_finding',
      details:   { finding, score },
      success:   true,
    });

    return { content: [{ type: 'text', text: JSON.stringify({ recorded: true, txnId }) }] };
  }
);

server.tool(
  'search_similar_transactions',
  'Search similar historical transactions using embeddings and Atlas vector search',
  {
    txnId: z.string().optional(),
    query: z.string().optional(),
    accountId: z.string().optional(),
    limit: z.number().min(1).max(20).optional(),
  },
  async ({ txnId, query, accountId, limit = 5 }) => {
    if (!txnId && !query) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: 'Please provide a txnId or query to search similar transactions.' }),
        }],
      };
    }

    let queryVector;
    if (txnId) {
      const transaction = await Transaction.findOne({ txnId }).lean();
      if (!transaction) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Transaction ${txnId} not found.` }),
          }],
        };
      }

      queryVector = transaction.aiVector && transaction.aiVector.length
        ? transaction.aiVector
        : await vectorService.persistTransactionEmbedding(transaction);
    } else {
      queryVector = await vectorService.generateTextEmbedding(query);
    }

    const results = await vectorService.searchSimilarTransactions({
      queryVector,
      limit,
      accountId,
      excludeTxnId: txnId,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ results, source: txnId ? 'transaction_vector' : 'query_vector' }),
      }],
    };
  }
);

const transport = new StreamableHTTPServerTransport();

// ── Start MCP server ──────────────────────────────────────────
async function startMcpServer() {
  try {
    await server.connect(transport);
    logger.info('MCP server started on HTTP transport');
  } catch (err) {
    logger.error({ err }, 'Failed to start MCP server');
    throw err;
  }
}

async function stopMcpServer() {
  try {
    await transport.close();
  } catch (err) {
    logger.warn({ err }, 'Failed to close MCP transport');
  }

  try {
    await server.close();
  } catch (err) {
    logger.warn({ err }, 'Failed to close MCP server');
  }
}

module.exports = { server, startMcpServer, stopMcpServer, transport };
