'use strict';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger').forModule('auth');

/**
 * Generate a JWT token for analyst/admin users.
 */
function generateToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
    issuer:    'ghosttrace-ai',
  });
}

/**
 * Verify a JWT token. Returns decoded payload or throws.
 */
function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret, { issuer: 'ghosttrace-ai' });
}

/**
 * Verify an API key by comparing its SHA-256 hash
 * against the stored hash in env vars.
 */
function verifyApiKey(rawKey) {
  if (!config.auth.apiKeyHash) {
    // In dev mode with no key configured, accept any key
    if (config.app.isDev) {
      logger.warn('API_KEY_HASH not set — accepting any key in dev mode');
      return true;
    }
    return false;
  }

  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(config.auth.apiKeyHash)
  );
}

/**
 * Exchange an API key for a short-lived JWT.
 * Called by POST /api/v1/auth/token
 */
function exchangeApiKeyForToken(apiKey) {
  if (!verifyApiKey(apiKey)) {
    throw new Error('Invalid API key');
  }

  return generateToken({
    sub:  'api-user',
    role: 'analyst',
  });
}

module.exports = { generateToken, verifyToken, verifyApiKey, exchangeApiKeyForToken };
