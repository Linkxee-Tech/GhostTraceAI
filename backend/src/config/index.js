'use strict';

require('dotenv').config();

// Load env vars and enforce production requirements
const REQUIRED_VARS = [
  'MONGODB_URI',
  'MONGODB_DB_NAME',
  'GEMINI_MODEL',
  'GOOGLE_API_KEY',
  'JWT_SECRET',
  'MCP_AUTH_SECRET',
];

function validateConfig() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in the missing values.'
    );
  }
}

function validateProductionSecrets() {
  const suspicious = [];
  const secretChecks = [
    { key: 'JWT_SECRET', bad: ['your-', 'dev-secret', 'change-in-prod', 'test-secret'] },
    { key: 'MCP_AUTH_SECRET', bad: ['your-', 'test-', 'dev-'] },
    { key: 'GOOGLE_API_KEY', bad: ['AIza...'] },
    { key: 'WEBHOOK_SIGNING_SECRET', bad: ['your-webhook-signing-secret'] },
  ];
  for (const check of secretChecks) {
    const value = String(process.env[check.key] || '').toLowerCase();
    if (!value) continue;
    if (check.bad.some((token) => value.includes(token))) suspicious.push(check.key);
  }
  if (suspicious.length > 0) {
    throw new Error(`Unsafe placeholder secrets detected for: ${suspicious.join(', ')}. Rotate and set real secrets before deploy.`);
  }
}

// In production, require full config and secure CORS.
if (process.env.NODE_ENV === 'production') {
  validateConfig();

  // Prevent auth bypass in production
  if (process.env.BYPASS_AUTH === 'true') {
    throw new Error('BYPASS_AUTH cannot be enabled in production.');
  }

  const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (corsOrigins.some((origin) => /localhost|127\.0\.0\.1/i.test(origin))) {
    throw new Error('CORS_ORIGINS contains localhost in production. Set it to your deployed frontend origin(s).');
  }

  validateProductionSecrets();

} else if (process.env.NODE_ENV !== 'test') {
  // Development startup warnings
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`Missing environment vars: ${missing.join(', ')}. Copy .env.example to .env.`);
  }

  if (process.env.BYPASS_AUTH === 'true') {
    // eslint-disable-next-line no-console
    console.warn('BYPASS_AUTH is enabled in development. Do not enable it in shared or staging environments.');
  }
}

const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    allowVercelPreviewOrigins: process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true',
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  },

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'ghosttrace',
    changeStreamFullDoc: process.env.MONGODB_CHANGE_STREAM_FULL_DOC || 'updateLookup',
    options: {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    },
  },

  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-3.0-pro',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-3.0',
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '2048', 10),
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.1'),
    topP: 0.8,
    topK: 40,
  },

  agentBuilder: {
    project: process.env.AGENT_BUILDER_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.AGENT_BUILDER_LOCATION || 'us-central1',
    agentId: process.env.AGENT_BUILDER_AGENT_ID || '',
  },

  mcp: {
    port: parseInt(process.env.MCP_SERVER_PORT || '3002', 10),
    transport: process.env.MCP_TRANSPORT || 'stdio',
    authSecret: process.env.MCP_AUTH_SECRET || '',
    toolTimeoutMs: parseInt(process.env.MCP_TOOL_TIMEOUT_MS || '10000', 10),
  },

  websocket: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL_MS || '25000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT_MS || '60000', 10),
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000', 10),
  },

  agent: {
    blockThreshold: parseInt(process.env.FRAUD_SCORE_BLOCK_THRESHOLD || '80', 10),
    flagThreshold: parseInt(process.env.FRAUD_SCORE_FLAG_THRESHOLD || '50', 10),
    reviewThreshold: parseInt(process.env.FRAUD_SCORE_REVIEW_THRESHOLD || '65', 10),
    minConfidence: parseFloat(process.env.AGENT_CONFIDENCE_MIN || '0.7'),
    maxVelocityPerMinute: parseInt(process.env.MAX_VELOCITY_PER_MINUTE || '10', 10),
    geoAnomalyKmThreshold: parseInt(process.env.GEO_ANOMALY_KM_THRESHOLD || '2000', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  notifications: {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    emailRecipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(Boolean),
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  },

  enforcement: {
    webhookUrl: process.env.EXTERNAL_ENFORCEMENT_URL || '',
    webhookSecret: process.env.EXTERNAL_ENFORCEMENT_SECRET || '',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    apiKeyHash: process.env.API_KEY_HASH || '',
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    resetPasswordUrl: process.env.RESET_PASSWORD_URL || 'http://localhost:3000',
  },
  webhooks: {
    signingSecret: process.env.WEBHOOK_SIGNING_SECRET || '',
    signatureToleranceSec: parseInt(process.env.WEBHOOK_SIGNATURE_TOLERANCE_SEC || '300', 10),
    stripeSigningSecret: process.env.WEBHOOK_STRIPE_SIGNING_SECRET || '',
    paystackSigningSecret: process.env.WEBHOOK_PAYSTACK_SIGNING_SECRET || '',
  },

  mfa: {
    autoVerifyEnabled: process.env.MFA_AUTO_VERIFY_ENABLED === 'true' || process.env.NODE_ENV !== 'production',
    autoVerifyCode: process.env.MFA_AUTO_VERIFY_CODE || '123456',
  },
};

module.exports = config;
