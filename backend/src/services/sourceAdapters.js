'use strict';

function toCanonicalFromStripe(event = {}) {
  const obj = event?.data?.object || {};
  return {
    transactionId: obj.id || event.id,
    accountId: obj.customer || obj.source || 'unknown-account',
    userId: obj.customer || null,
    amount: typeof obj.amount === 'number' ? obj.amount / 100 : obj.amount,
    currency: obj.currency || 'USD',
    timestamp: event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString(),
    location: {
      country: obj.billing_details?.address?.country || obj.payment_method_details?.card?.country,
      city: obj.billing_details?.address?.city,
    },
    device: {
      fingerprint: obj.payment_method_details?.card?.fingerprint,
      ipAddress: obj.client_ip || undefined,
      ipCountry: obj.payment_method_details?.card?.country,
      userAgent: obj.user_agent,
    },
    merchant: {
      id: obj.on_behalf_of || null,
      name: obj.statement_descriptor || 'Stripe Merchant',
      category: obj.description || 'payment',
      country: obj.payment_method_details?.card?.country,
      riskTier: 'medium',
    },
    channel: 'api',
    paymentMethod: 'card',
    sourceSystem: 'stripe',
    metadata: event,
    riskFlags: [],
    type: 'purchase',
  };
}

function toCanonicalFromPaystack(event = {}) {
  const data = event?.data || {};
  return {
    transactionId: data.reference || event.event,
    accountId: data.customer?.customer_code || data.authorization?.authorization_code || 'unknown-account',
    userId: data.customer?.email || null,
    amount: typeof data.amount === 'number' ? data.amount / 100 : data.amount,
    currency: data.currency || 'USD',
    timestamp: data.paid_at || data.created_at || new Date().toISOString(),
    location: {
      country: data.authorization?.country_code,
      city: null,
    },
    device: {
      fingerprint: data.authorization?.signature,
      ipAddress: data.ip_address,
      ipCountry: data.authorization?.country_code,
      userAgent: data.authorization?.channel,
    },
    merchant: {
      id: data.domain || null,
      name: 'Paystack Merchant',
      category: data.channel || 'payment',
      country: data.authorization?.country_code,
      riskTier: 'medium',
    },
    channel: data.channel || 'api',
    paymentMethod: data.channel === 'bank' ? 'bank_transfer' : 'card',
    sourceSystem: 'paystack',
    metadata: event,
    riskFlags: [],
    type: 'purchase',
  };
}

function adaptIncomingEvent({ provider, payload, sourceSystem }) {
  if (provider === 'stripe') return toCanonicalFromStripe(payload);
  if (provider === 'paystack') return toCanonicalFromPaystack(payload);
  return { ...payload, sourceSystem: payload.sourceSystem || sourceSystem };
}

module.exports = { adaptIncomingEvent };

