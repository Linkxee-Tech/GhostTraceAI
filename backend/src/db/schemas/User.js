'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const SessionSchema = new Schema(
  {
    sessionId: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    deviceFingerprint: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: '' },
    role: {
      type: String,
      enum: ['admin', 'analyst', 'auditor', 'viewer'],
      default: 'analyst',
      index: true,
    },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      index: true,
    },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    sessions: [SessionSchema],
    passwordResetTokenHash: { type: String },
    passwordResetExpiresAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

UserSchema.methods.toPublicJson = function () {
  return {
    userId: this.userId,
    email: this.email,
    name: this.name,
    role: this.role,
    status: this.status,
    lastLoginAt: this.lastLoginAt,
    lastLoginIp: this.lastLoginIp,
    sessions: this.sessions.map((s) => ({
      sessionId: s.sessionId,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      deviceFingerprint: s.deviceFingerprint,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      isActive: s.isActive,
    })),
  };
};

module.exports = mongoose.model('User', UserSchema);
