'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.MONGODB_DB_NAME = 'ghosttrace_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MCP_AUTH_SECRET = 'test-mcp-secret';
process.env.GEMINI_MODEL = 'gemini-3.0-pro';

const { ruleBasedFallback } = require('../../src/services/geminiService');
const config = require('../../src/config');

/**
 * Synthetic attack patterns for simulation testing.
 * Each represents a real-world fraud scenario.
 */
const FRAUD_SCENARIOS = [
  {
    name: 'Card Testing Attack',
    description: 'Attacker tests small amounts rapidly to verify card validity',
    txn: {
      txnId: 'SIM-001', accountId: 'ACC-SIM-001',
      amount: 1.00, currency: 'USD', type: 'purchase', channel: 'online',
      merchant: { name: 'Online Store', category: 'retail', country: 'US', riskTier: 'low' },
      device: { isKnownDevice: false, isTor: false, isVpn: false, ipCountry: 'NG' },
      geo: { country: 'NG', distanceFromLastKm: 0 },
    },
    velocity: { count1min: 8, count5min: 25 },
    expectFraud: true,
    minScore: 40,
  },
  {
    name: 'Account Takeover — New Device + Geo Jump',
    description: 'Legitimate account suddenly accessed from new device 8,000km away',
    txn: {
      txnId: 'SIM-002', accountId: 'ACC-SIM-002',
      amount: 5000, currency: 'USD', type: 'wire', channel: 'online',
      merchant: { name: 'Wire Transfer', category: 'financial_services', country: 'RU', riskTier: 'high' },
      device: { isKnownDevice: false, isTor: false, isVpn: true, ipCountry: 'RU' },
      geo: { country: 'RU', distanceFromLastKm: 8200 },
    },
    velocity: { count1min: 0, count5min: 2 },
    expectFraud: true,
    minScore: 70,
  },
  {
    name: 'TOR Exit Node Purchase',
    description: 'Transaction originating from TOR anonymization network',
    txn: {
      txnId: 'SIM-003', accountId: 'ACC-SIM-003',
      amount: 250, currency: 'USD', type: 'purchase', channel: 'online',
      merchant: { name: 'Electronics Shop', category: 'electronics', country: 'DE', riskTier: 'medium' },
      device: { isKnownDevice: false, isTor: true, isVpn: false, ipCountry: 'XX' },
      geo: { country: 'DE', distanceFromLastKm: 50 },
    },
    velocity: { count1min: 1, count5min: 3 },
    expectFraud: true,
    minScore: 50,
  },
  {
    name: 'Legitimate High-Value Transaction',
    description: 'Known device, normal merchant, moderate amount — should clear',
    txn: {
      txnId: 'SIM-004', accountId: 'ACC-SIM-004',
      amount: 1500, currency: 'USD', type: 'purchase', channel: 'online',
      merchant: { name: 'Apple Store', category: 'electronics', country: 'US', riskTier: 'low' },
      device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
      geo: { country: 'NG', distanceFromLastKm: 2 },
    },
    velocity: { count1min: 0, count5min: 1 },
    expectFraud: false,
    maxScore: 40,
  },
  {
    name: 'Crypto Exchange — Multi-indicator',
    description: 'Crypto exchange + geo anomaly + high velocity = coordinated fraud',
    txn: {
      txnId: 'SIM-005', accountId: 'ACC-SIM-005',
      amount: 47000, currency: 'USD', type: 'wire', channel: 'api',
      merchant: { name: 'Crypto Exchange', category: 'cryptocurrency', country: 'UA', riskTier: 'high' },
      device: { isKnownDevice: false, isTor: false, isVpn: true, ipCountry: 'RU' },
      geo: { country: 'UA', distanceFromLastKm: 6742 },
    },
    velocity: { count1min: 4, count5min: 9 },
    expectFraud: true,
    minScore: 80,
  },
  {
    name: 'Recurring Subscription — Should Clear',
    description: 'Monthly Spotify charge from known device — fast path clear',
    txn: {
      txnId: 'SIM-006', accountId: 'ACC-SIM-006',
      amount: 9.99, currency: 'USD', type: 'purchase', channel: 'online',
      merchant: { name: 'Spotify', category: 'entertainment', country: 'SE', riskTier: 'low' },
      device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
      geo: { country: 'NG', distanceFromLastKm: 0 },
    },
    velocity: { count1min: 0, count5min: 0 },
    expectFraud: false,
    maxScore: 20,
  },
];

describe('Fraud Simulation Scenarios', () => {
  FRAUD_SCENARIOS.forEach((scenario) => {
    describe(scenario.name, () => {
      let result;

      beforeAll(() => {
        result = ruleBasedFallback(scenario.txn, scenario.velocity);
      });

      test(`score is ${scenario.expectFraud ? `>= ${scenario.minScore}` : `<= ${scenario.maxScore}`}`, () => {
        if (scenario.expectFraud && scenario.minScore !== undefined) {
          expect(result.fraudScore).toBeGreaterThanOrEqual(scenario.minScore);
        }
        if (!scenario.expectFraud && scenario.maxScore !== undefined) {
          expect(result.fraudScore).toBeLessThanOrEqual(scenario.maxScore);
        }
      });

      test('isFraud matches expectation', () => {
        if (scenario.minScore && scenario.minScore >= config.agent.blockThreshold) {
          expect(result.isFraud).toBe(true);
        }
        if (scenario.maxScore && scenario.maxScore < config.agent.flagThreshold) {
          expect(result.isFraud).toBe(false);
        }
      });

      test('returns valid recommended action', () => {
        const validActions = ['clear', 'flag', 'block', 'freeze', 'escalate', 'request_review'];
        expect(validActions).toContain(result.recommendedAction);
      });

      test('provides human-readable explanation', () => {
        expect(typeof result.explanation).toBe('string');
        expect(result.explanation.length).toBeGreaterThan(10);
      });

      test('riskFactors is an array', () => {
        expect(Array.isArray(result.riskFactors)).toBe(true);
      });
    });
  });
});

// ── Score distribution test ───────────────────────────────────
describe('Score Distribution Sanity', () => {
  test('fraud scores span the full range across scenarios', () => {
    const scores = FRAUD_SCENARIOS.map((s) =>
      ruleBasedFallback(s.txn, s.velocity).fraudScore
    );
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    expect(min).toBeLessThan(30);  // At least one low-risk
    expect(max).toBeGreaterThan(70); // At least one high-risk
  });

  test('all scores are integers in 0-100', () => {
    FRAUD_SCENARIOS.forEach((s) => {
      const result = ruleBasedFallback(s.txn, s.velocity);
      expect(Number.isInteger(result.fraudScore)).toBe(true);
      expect(result.fraudScore).toBeGreaterThanOrEqual(0);
      expect(result.fraudScore).toBeLessThanOrEqual(100);
    });
  });
});
