'use strict';

const crypto = require('crypto');

function verifyHmacSignature({ rawBody, timestamp, signatureHeader, secret }) {
  if (!secret) return false;
  if (!rawBody || !timestamp || !signatureHeader) return false;
  const payload = `${timestamp}.${rawBody}`;
  const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expected = `sha256=${digest}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
}

function verifyStripeSignature({ rawBody, stripeSignatureHeader, secret, toleranceSec = 300 }) {
  if (!rawBody || !stripeSignatureHeader || !secret) return false;
  const parts = stripeSignatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  if (!isFreshTimestamp(ts, toleranceSec)) return false;
  const signedPayload = `${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

function verifyPaystackSignature({ rawBody, signatureHeader, secret }) {
  if (!rawBody || !signatureHeader || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signatureHeader)));
}

function isFreshTimestamp(unixSeconds, toleranceSec = 300) {
  const ts = Number(unixSeconds);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= toleranceSec;
}

module.exports = {
  verifyHmacSignature,
  verifyStripeSignature,
  verifyPaystackSignature,
  isFreshTimestamp,
};
