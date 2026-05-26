'use strict';

const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config       = require('../config');
const logger       = require('../utils/logger').forModule('auth');
const User         = require('../db/schemas/User');
const { AuditLog } = require('../db/schemas/Fraud');
const { sendEmailAlert } = require('./notificationService');

function generateToken(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
    issuer:    'ghosttrace-ai',
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.auth.jwtSecret, { issuer: 'ghosttrace-ai' });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  const hash = crypto.scryptSync(password, user.passwordSalt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(user.passwordHash));
}

function verifyApiKey(rawKey) {
  if (!config.auth.apiKeyHash) {
    if (config.app.isDev) {
      logger.warn('API_KEY_HASH not set — accepting any key in dev mode');
      return true;
    }
    return false;
  }

  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(config.auth.apiKeyHash));
}

function exchangeApiKeyForToken(apiKey) {
  if (!verifyApiKey(apiKey)) {
    throw new Error('Invalid API key');
  }

  return generateToken({
    sub:  'api-user',
    role: 'analyst',
  });
}

async function createOrUpdateSession(user, meta = {}) {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    userAgent: meta.userAgent || 'unknown',
    ipAddress: meta.ipAddress || 'unknown',
    deviceFingerprint: meta.deviceFingerprint || 'unknown',
    createdAt: new Date(),
    lastSeenAt: new Date(),
    isActive: true,
  };

  user.sessions = [session, ...(user.sessions || [])].slice(0, 20);
  user.lastLoginAt = new Date();
  user.lastLoginIp = meta.ipAddress || user.lastLoginIp;
  await user.save();

  return sessionId;
}

async function loginWithEmail(email, password, meta = {}) {
  const user = await User.findOne({ email: email.toLowerCase().trim(), status: 'active' });
  if (!user) throw new Error('Invalid email or password');
  if (!verifyPassword(password, user)) throw new Error('Invalid email or password');

  const sessionId = await createOrUpdateSession(user, meta);
  const token = generateToken({
    sub: user.userId,
    role: user.role,
    accountType: user.email.includes('demo') ? 'demo' : user.role,
    email: user.email,
    name: user.name || '',
    sessionId,
  });

  await AuditLog.create({
    auditId: uuidv4(),
    eventType: 'action_executed',
    actorType: 'analyst',
    actorId: user.userId,
    txnId: null,
    action: 'user_login',
    details: { email: user.email, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
    success: true,
    createdAt: new Date(),
  });

  return { user: user.toPublicJson(), token };
}

async function getCurrentUser(userId) {
  const user = await User.findOne({ userId }).lean();
  if (!user) return null;
  return {
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    sessions: user.sessions || [],
  };
}

async function createUser({ email, password, name, role = 'analyst' }) {
  const normalizedEmail = email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    throw new Error('A user with that email already exists');
  }

  const { salt, hash } = hashPassword(password);
  const userId = `user-${uuidv4().slice(0, 8)}`;

  const user = await User.create({
    userId,
    email: normalizedEmail,
    name: name || '',
    role,
    passwordHash: hash,
    passwordSalt: salt,
    status: 'active',
  });

  return user.toPublicJson();
}

async function listUsers(filter = {}) {
  const query = {};
  if (filter.role) query.role = filter.role;
  if (filter.status) query.status = filter.status;
  const users = await User.find(query).sort({ createdAt: -1 }).lean();
  return users.map((user) => ({
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    sessionCount: (user.sessions || []).filter((s) => s.isActive).length,
  }));
}

async function updateUser(userId, update) {
  const changes = {};
  if (update.role) changes.role = update.role;
  if (update.status) changes.status = update.status;
  if (update.name !== undefined) changes.name = update.name;
  if (update.email) changes.email = update.email.toLowerCase().trim();

  const user = await User.findOneAndUpdate({ userId }, { $set: changes }, { new: true });
  if (!user) throw new Error('User not found');
  return user.toPublicJson();
}

async function revokeSession(userId, sessionId) {
  const user = await User.findOne({ userId });
  if (!user) throw new Error('User not found');
  user.sessions = (user.sessions || []).map((session) => {
    if (session.sessionId === sessionId) {
      return { ...session.toObject(), isActive: false, lastSeenAt: new Date() };
    }
    return session;
  });
  await user.save();
  return true;
}

async function createPasswordResetToken(email) {
  const user = await User.findOne({ email: email.toLowerCase().trim(), status: 'active' });
  if (!user) return null;

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await user.save();

  const resetUrl = `${config.app.resetPasswordUrl || 'http://localhost:3000'}/reset-password?token=${rawToken}`;

  await sendEmailAlert(
    'GhostTrace AI Password Reset',
    `<p>Use the link below to reset your password. It expires in 60 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  );

  return { email: user.email, resetUrl };
}

async function resetPassword(token, newPassword) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  });
  if (!user) throw new Error('Invalid or expired password reset token');

  const { salt, hash } = hashPassword(newPassword);
  user.passwordSalt = salt;
  user.passwordHash = hash;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  return user.toPublicJson();
}

async function findUserBySession(userId, sessionId) {
  return User.findOne({ userId, 'sessions.sessionId': sessionId, 'sessions.isActive': true });
}

async function verifyTokenSession(token) {
  const payload = verifyToken(token);
  if (!payload.sessionId || !payload.sub) return payload;

  const user = await findUserBySession(payload.sub, payload.sessionId);
  if (!user) {
    throw new Error('Invalid or expired session');
  }

  return payload;
}

module.exports = {
  generateToken,
  verifyToken,
  verifyTokenSession,
  verifyApiKey,
  exchangeApiKeyForToken,
  loginWithEmail,
  createUser,
  listUsers,
  updateUser,
  revokeSession,
  getCurrentUser,
  createPasswordResetToken,
  resetPassword,
};
