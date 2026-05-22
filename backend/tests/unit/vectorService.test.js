'use strict';

process.env.NODE_ENV = 'test';
process.env.GEMINI_MODEL = 'gemini-3.0-pro';

const mockEmbed = [0.1, 0.2, 0.3];

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        embedContent: jest.fn().mockResolvedValue({ data: [{ embedding: mockEmbed }] }),
      }),
    })),
  };
});

const Transaction = require('../../src/db/schemas/Transaction');
const { getDb } = require('../../src/db/connection');
const vectorService = require('../../src/services/vectorService');

jest.mock('../../src/db/connection', () => ({
  getDb: jest.fn(),
}));

jest.mock('../../src/db/schemas/Transaction', () => ({
  find: jest.fn(),
  updateOne: jest.fn(),
  findOne: jest.fn(),
}));

afterEach(() => {
  jest.clearAllMocks();
});

test('persistTransactionEmbedding generates and stores aiVector', async () => {
  const txn = { txnId: 'TXN-123' };
  Transaction.updateOne.mockResolvedValue({ acknowledged: true });

  const result = await vectorService.persistTransactionEmbedding(txn);

  expect(result).toEqual(mockEmbed);
  expect(Transaction.updateOne).toHaveBeenCalledWith(
    { txnId: txn.txnId },
    { $set: { aiVector: mockEmbed } }
  );
});

test('searchSimilarTransactions falls back to cosine similarity when Atlas search is unavailable', async () => {
  const queryVector = [1, 0, 1];
  const mockDocs = [
    { txnId: 'TXN-1', accountId: 'ACC1', aiVector: [1, 0, 1], amount: 100 },
    { txnId: 'TXN-2', accountId: 'ACC1', aiVector: [0, 1, 0], amount: 200 },
  ];

  getDb.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockRejectedValue(new Error('Atlas search unavailable')),
      }),
    }),
  });

  Transaction.find.mockReturnValue({
    lean: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue(mockDocs),
    }),
  });

  const results = await vectorService.searchSimilarTransactions({
    queryVector,
    limit: 2,
    accountId: 'ACC1',
  });

  expect(results).toHaveLength(1);
  expect(results[0].txnId).toBe('TXN-1');
  expect(results[0]).toHaveProperty('similarityScore');
});

test('searchSimilarTransactions returns Atlas search results when available', async () => {
  const queryVector = [1, 1, 1];
  const atlasResults = [{ txnId: 'TXN-3', accountId: 'ACC2', similarityScore: 0.99 }];

  getDb.mockReturnValue({
    collection: jest.fn().mockReturnValue({
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue(atlasResults),
      }),
    }),
  });

  const results = await vectorService.searchSimilarTransactions({
    queryVector,
    limit: 1,
  });

  expect(results).toEqual(atlasResults);
});
