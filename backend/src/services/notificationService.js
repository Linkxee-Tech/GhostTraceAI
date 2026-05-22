'use strict';

const nodemailer = require('nodemailer');
const config     = require('../config');
const logger     = require('../utils/logger').forModule('notifications');

// ── Email transporter (lazy-init) ────────────────────────────
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.notifications.smtp.host) return null;

  transporter = nodemailer.createTransport({
    host:   config.notifications.smtp.host,
    port:   config.notifications.smtp.port,
    secure: config.notifications.smtp.port === 465,
    auth: {
      user: config.notifications.smtp.user,
      pass: config.notifications.smtp.pass,
    },
  });
  return transporter;
}

// ── Slack notification ────────────────────────────────────────
async function sendSlackAlert(payload) {
  const url = config.notifications.slackWebhookUrl;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
    logger.info('Slack alert sent');
  } catch (err) {
    logger.error({ err }, 'Slack notification failed');
  }
}

// ── Email notification ────────────────────────────────────────
async function sendEmailAlert(subject, html) {
  const tp = getTransporter();
  if (!tp || !config.notifications.emailRecipients.length) return;

  try {
    await tp.sendMail({
      from:    `"GhostTrace AI" <${config.notifications.smtp.user}>`,
      to:      config.notifications.emailRecipients.join(', '),
      subject,
      html,
    });
    logger.info({ recipients: config.notifications.emailRecipients }, 'Email alert sent');
  } catch (err) {
    logger.error({ err }, 'Email notification failed');
  }
}

// ── High-risk alert (block/freeze events) ────────────────────
async function sendHighRiskAlert({ txn, alert, analysisResult }) {
  const severity  = alert.severity.toUpperCase();
  const scoreColor = analysisResult.fraudScore >= 90 ? '#ff3b5c' : '#ff6b35';
  const subject   = `[GhostTrace AI] ${severity} FRAUD ALERT — ${txn.txnId}`;

  // Email HTML
  const html = `
    <div style="font-family:monospace;background:#0a0c0f;color:#e8edf2;padding:24px;border-radius:8px;">
      <h2 style="color:#ff3b5c;margin:0 0 16px;">🚨 ${severity} Fraud Alert</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#6b7a8d;padding:4px 0;">Transaction ID</td><td style="color:#fff;font-weight:bold;">${txn.txnId}</td></tr>
        <tr><td style="color:#6b7a8d;padding:4px 0;">Account</td><td>${txn.accountId}</td></tr>
        <tr><td style="color:#6b7a8d;padding:4px 0;">Amount</td><td style="color:#ff3b5c;font-weight:bold;">$${txn.amount.toLocaleString()} ${txn.currency}</td></tr>
        <tr><td style="color:#6b7a8d;padding:4px 0;">Fraud Score</td><td style="color:${scoreColor};font-weight:bold;">${analysisResult.fraudScore}/100</td></tr>
        <tr><td style="color:#6b7a8d;padding:4px 0;">Agent Action</td><td>${analysisResult.recommendedAction.toUpperCase()}</td></tr>
        <tr><td style="color:#6b7a8d;padding:4px 0;">Alert ID</td><td>${alert.alertId}</td></tr>
      </table>
      <div style="margin-top:16px;padding:12px;background:#151b23;border-radius:6px;border-left:3px solid #ff3b5c;">
        <strong style="color:#ff3b5c;">AI Explanation:</strong><br/>
        <span style="color:#e8edf2;">${analysisResult.explanation}</span>
      </div>
      <div style="margin-top:16px;color:#6b7a8d;font-size:11px;">
        GhostTrace AI · ${new Date().toISOString()}
      </div>
    </div>
  `;

  // Slack payload
  const slackPayload = {
    text: `🚨 *${severity} Fraud Alert* — Score: ${analysisResult.fraudScore}/100`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🚨 ${severity} Fraud Detected`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Transaction:*\n${txn.txnId}` },
          { type: 'mrkdwn', text: `*Account:*\n${txn.accountId}` },
          { type: 'mrkdwn', text: `*Amount:*\n$${txn.amount.toLocaleString()} ${txn.currency}` },
          { type: 'mrkdwn', text: `*Fraud Score:*\n${analysisResult.fraudScore}/100` },
          { type: 'mrkdwn', text: `*Action:*\n${analysisResult.recommendedAction.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Alert ID:*\n${alert.alertId}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*AI Explanation:*\n${analysisResult.explanation}` },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `GhostTrace AI · ${new Date().toISOString()}` }],
      },
    ],
  };

  await Promise.allSettled([
    sendEmailAlert(subject, html),
    sendSlackAlert(slackPayload),
  ]);
}

// ── Review request notification ───────────────────────────────
async function sendReviewRequest({ txn, review, analysisResult }) {
  const subject = `[GhostTrace AI] Review Required — ${txn.txnId} (Score: ${analysisResult.fraudScore})`;

  const slackPayload = {
    text: `⚠️ *Review Required* — Transaction ${txn.txnId}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⚠️ *Human Review Required*\nTransaction *${txn.txnId}* needs analyst review.\nScore: *${analysisResult.fraudScore}/100* · SLA: 15 minutes\nReview ID: \`${review.reviewId}\``,
        },
      },
    ],
  };

  await Promise.allSettled([
    sendEmailAlert(subject, `<p>Review required for ${txn.txnId}. Score: ${analysisResult.fraudScore}/100. Review ID: ${review.reviewId}</p>`),
    sendSlackAlert(slackPayload),
  ]);
}

module.exports = { sendHighRiskAlert, sendReviewRequest, sendEmailAlert, sendSlackAlert };
