'use strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.MONGODB_DB_NAME = 'ghosttrace_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MCP_AUTH_SECRET = 'test-mcp-secret';
process.env.GEMINI_MODEL = 'gemini-3.0-pro';

const { ruleBasedFallback } = require('../../src/services/geminiService');

// ── Rule-based fallback tests ─────────────────────────────────
describe('ruleBasedFallback', () => {
  const baseTxn = {
    txnId: 'TXN-TEST-001',
    accountId: 'ACC-001',
    amount: 100,
    currency: 'USD',
    type: 'purchase',
    merchant: { riskTier: 'low' },
    device: { isKnownDevice: true, isTor: false, isVpn: false, ipCountry: 'NG' },
    geo: { country: 'NG', distanceFromLastKm: 10 },
  };

  test('low-risk transaction scores < 30', () => {
    const result = ruleBasedFallback(baseTxn, { count1min: 0 });
    expect(result.fraudScore).toBeLessThan(30);
    expect(result.isFraud).toBe(false);
    expect(result.recommendedAction).toBe('clear');
  });

  test('TOR detection raises score significantly', () => {
    const txn = { ...baseTxn, device: { ...baseTxn.device, isTor: true } };
    const result = ruleBasedFallback(txn, { count1min: 0 });
    expect(result.fraudScore).toBeGreaterThan(30);
  });

  test('high velocity spikes score', () => {
    const result = ruleBasedFallback(baseTxn, { count1min: 6 });
    expect(result.fraudScore).toBeGreaterThanOrEqual(30);
  });

  test('large geo jump raises score', () => {
    const txn = { ...baseTxn, geo: { ...baseTxn.geo, distanceFromLastKm: 5000 } };
    const result = ruleBasedFallback(txn, { count1min: 0 });
    expect(result.fraudScore).toBeGreaterThan(20);
  });

  test('multiple high-risk signals combine correctly', () => {
    const txn = {
      ...baseTxn,
      amount: 15000,
      device: { isKnownDevice: false, isTor: true, isVpn: true, ipCountry: 'RU' },
      geo: { country: 'UA', distanceFromLastKm: 7000 },
      merchant: { riskTier: 'high' },
    };
    const result = ruleBasedFallback(txn, { count1min: 7 });
    expect(result.fraudScore).toBeGreaterThanOrEqual(80);
    expect(result.isFraud).toBe(true);
    expect(['block', 'freeze', 'escalate']).toContain(result.recommendedAction);
  });

  test('score is always clamped 0-100', () => {
    const txn = {
      ...baseTxn,
      amount: 99999,
      device: { isKnownDevice: false, isTor: true, isVpn: true, ipCountry: 'XX' },
      geo: { country: 'XX', distanceFromLastKm: 20000 },
      merchant: { riskTier: 'high' },
    };
    const result = ruleBasedFallback(txn, { count1min: 20 });
    expect(result.fraudScore).toBeGreaterThanOrEqual(0);
    expect(result.fraudScore).toBeLessThanOrEqual(100);
  });

  test('returns required fields', () => {
    const result = ruleBasedFallback(baseTxn, {});
    expect(result).toHaveProperty('fraudScore');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('isFraud');
    expect(result).toHaveProperty('recommendedAction');
    expect(result).toHaveProperty('riskFactors');
    expect(result).toHaveProperty('explanation');
    expect(result).toHaveProperty('reasoning');
  });
});

// ── Config validation tests ───────────────────────────────────
describe('Config', () => {
  test('loads without throwing in test env', () => {
    expect(() => require('../../src/config')).not.toThrow();
  });

  test('agent thresholds are sensible', () => {
    const config = require('../../src/config');
    expect(config.agent.blockThreshold).toBeGreaterThan(config.agent.flagThreshold);
    expect(config.agent.reviewThreshold).toBeGreaterThan(config.agent.flagThreshold);
    expect(config.agent.blockThreshold).toBeLessThanOrEqual(100);
  });
});

// ── Auth service tests ────────────────────────────────────────
describe('AuthService', () => {
  const { generateToken, verifyToken } = require('../../src/services/authService');

  test('generates and verifies a JWT', () => {
    const token = generateToken({ sub: 'test-user', role: 'analyst' });
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.sub).toBe('test-user');
    expect(decoded.role).toBe('analyst');
    expect(decoded.iss).toBe('ghosttrace-ai');
  });

  test('throws on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });

  test('throws on tampered token', () => {
    const token = generateToken({ sub: 'user', role: 'analyst' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyToken(tampered)).toThrow();
  });
});

// ── Utils tests ───────────────────────────────────────────────
describe('Logger', () => {
  test('creates child logger with module name', () => {
    const logger = require('../../src/utils/logger');
    const child = logger.forModule('test-module');
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });
});
