'use strict';

const { verifyToken, verifyApiKey } = require('../../services/authService');
const logger = require('../../utils/logger').forModule('authMiddleware');

/**
 * Authenticate requests using:
 *   1. Bearer JWT  →  Authorization: Bearer <token>
 *   2. API Key     →  X-API-Key: <key>
 *
 * In development mode, both can be bypassed with BYPASS_AUTH=true.
 */
function authenticate(req, res, next) {
  // Dev bypass — never enable in production
  if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    req.user = { sub: 'dev-user', role: 'analyst' };
    return next();
  }

  // Try Bearer JWT first
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      req.user = verifyToken(token);
      return next();
    } catch (err) {
      logger.debug({ err: err.message }, 'JWT verification failed');
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
  }

  // Try API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    if (verifyApiKey(apiKey)) {
      req.user = { sub: 'api-key-user', role: 'analyst' };
      return next();
    }
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }

  return res.status(401).json({ success: false, error: 'Authentication required' });
}

/**
 * Require a specific role (for admin-only endpoints).
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
