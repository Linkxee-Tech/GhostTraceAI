 'use strict';

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger').forModule('gemini');
const { ModelExplanation } = require('../db/schemas/Fraud');
const { z } = require('zod');
const { toAnalysisContract } = require('../utils/analysisContract');

let geminiClient = null;
let model = null;

const PROMPT_VERSION = 'v2';

function getClient() {
  if (!geminiClient) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY environment variable not set');
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

function getModel() {
  if (!model) {
    const client = getClient();
    model = client.getGenerativeModel({
      model: config.gemini.model,
      generationConfig: {
        maxOutputTokens: config.gemini.maxOutputTokens,
        temperature: config.gemini.temperature,
        topP: config.gemini.topP,
        topK: config.gemini.topK,
        responseMimeType: 'application/json',
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }
  return model;
}

/**
 * Build the fraud analysis system prompt.
 * Strict JSON output contract prevents prompt injection from input data.
 */
function buildSystemPrompt() {
  return `You are a fraud risk analyzer. Review transaction data and return only valid JSON.

Required response schema:
{
  "fraudScore": <integer 0-100>,
  "confidence": <float 0.0-1.0>,
  "isFraud": <boolean>,
  "recommendedAction": <one of: "clear" | "flag" | "block" | "freeze" | "escalate" | "request_review">,
  "riskFactors": [
    {
      "factor": <string>,
      "score": <integer 0-100>,
      "description": <string>
    }
  ],
  "explanation": <string>,
  "reasoning": [<string>],
  "anomalies": [<string>]
}

Action guidance:
- clear: score < 50
- flag: score 50-64
- request_review: score 65-79
- block: score 80-89
- freeze: score 80+ with takeover indicators
- escalate: score 90+
`;
}

/**
 * Build the transaction analysis user prompt.
 * Input data is sandboxed in a JSON block to prevent injection.
 */
function buildTransactionPrompt(txn, velocityData, historicalContext) {
  // Sanitize string fields before embedding in prompt
  const sanitize = (v) =>
    typeof v === 'string' ? v.replace(/[`\n\r]/g, ' ').substring(0, 200) : v;

  const safePayload = {
    txnId: sanitize(txn.txnId),
    accountId: sanitize(txn.accountId),
    amount: txn.amount,
    currency: txn.currency,
    type: sanitize(txn.type),
    channel: sanitize(txn.channel),
    timestamp: txn.createdAt,
    merchant: txn.merchant
      ? {
          name: sanitize(txn.merchant.name),
          category: sanitize(txn.merchant.category),
          mcc: sanitize(txn.merchant.mcc),
          country: sanitize(txn.merchant.country),
          riskTier: txn.merchant.riskTier,
        }
      : null,
    geo: txn.geo
      ? {
          country: sanitize(txn.geo.country),
          city: sanitize(txn.geo.city),
          distanceFromLastKm: txn.geo.distanceFromLastKm,
          isAnomaly: txn.geo.isAnomaly,
        }
      : null,
    device: txn.device
      ? {
          isKnownDevice: txn.device.isKnownDevice,
          isTor: txn.device.isTor,
          isVpn: txn.device.isVpn,
          ipCountry: sanitize(txn.device.ipCountry),
        }
      : null,
    velocity: velocityData,
    historicalContext,
  };

  return `Analyze this financial transaction for fraud risk:

<transaction_data>
${JSON.stringify(safePayload, null, 2)}
</transaction_data>

Return your analysis as JSON matching the required schema exactly.`;
}

/**
 * Validate and parse Gemini JSON response.
 * Returns null if response is invalid.
 */
function parseAndValidateResponse(raw) {
  try {
    // Strip any markdown code fences if model ignores responseMimeType
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Strict schema validation using zod
    const RiskFactor = z.object({
      factor: z.string(),
      score: z.number().int().min(0).max(100),
      description: z.string(),
    });

    const ResponseSchema = z.object({
      fraudScore: z.number().int().min(0).max(100),
      confidence: z.number().min(0).max(1),
      isFraud: z.boolean(),
      recommendedAction: z.enum(['clear', 'flag', 'block', 'freeze', 'escalate', 'request_review']),
      riskFactors: z.array(RiskFactor),
      explanation: z.string(),
      reasoning: z.array(z.string()).optional(),
      anomalies: z.array(z.string()).optional(),
    });

    const parsedValidated = ResponseSchema.safeParse(parsed);
    if (!parsedValidated.success) {
      logger.warn({ issues: parsedValidated.error.format(), raw: cleaned.substring(0, 2000) }, 'Gemini response failed schema validation');
      return null;
    }

    // Normalize and clamp numeric fields (defensive)
    const out = parsedValidated.data;
    out.fraudScore = Math.max(0, Math.min(100, Math.round(Number(out.fraudScore))));
    out.confidence = Math.max(0, Math.min(1, Number(out.confidence)));

    return out;
  } catch (err) {
    logger.error({ err, raw: raw?.substring(0, 500) }, 'Failed to parse Gemini response');
    return null;
  }
}

/**
 * Fallback scoring when the model is unavailable or returns invalid output.
 */
function ruleBasedFallback(txn, velocityData) {
  let score = 0;
  const reasons = [];

  if (velocityData?.count1min > 5) { score += 30; reasons.push('High transaction velocity'); }
  if (txn.geo?.distanceFromLastKm > config.agent.geoAnomalyKmThreshold) { score += 25; reasons.push('Geographic anomaly'); }
  if (!txn.device?.isKnownDevice) { score += 15; reasons.push('Unknown device'); }
  if (txn.device?.isTor)  { score += 35; reasons.push('TOR exit node detected'); }
  else if (txn.device?.isVpn) { score += 20; reasons.push('VPN usage detected'); }
  if (txn.merchant?.riskTier === 'high') { score += 15; reasons.push('High-risk merchant category'); }
  if (txn.amount > 10000) { score += 10; reasons.push('Large transaction amount'); }
  if (txn.geo?.country !== (txn.device?.ipCountry || txn.geo?.country)) { score += 20; reasons.push('Country mismatch'); }

  score = Math.min(score, 100);

  const base = {
    fraudScore: score,
    confidence: 0.6, // Lower confidence for rule-based
    isFraud: score >= config.agent.blockThreshold,
    recommendedAction: score >= 80 ? 'block' : score >= 65 ? 'request_review' : score >= 50 ? 'flag' : 'clear',
    riskFactors: reasons.map((r) => ({ factor: r, score: 50, description: r })),
    explanation: `Fallback assessment: ${reasons.join('; ')}`,
    reasoning: reasons,
    anomalies: reasons,
  };
  return { ...base, ...toAnalysisContract(base) };
}

/**
 * Main entry point: analyze a transaction with Gemini.
 */
async function analyzeFraud(txn, velocityData, historicalContext = {}) {
  const startTime = Date.now();
  const explanationId = uuidv4();
  let fallbackUsed = false;
  let fallbackReason = null;
  let rawResponse = '';
  let result = null;

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildTransactionPrompt(txn, velocityData, historicalContext);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  logger.info({ txnId: txn.txnId }, 'Starting Gemini fraud analysis');

  try {
    const aiModel = getModel();
    const geminiResult = await aiModel.generateContent(fullPrompt);
    rawResponse = geminiResult.response.text();

    result = parseAndValidateResponse(rawResponse);

    if (!result) {
      fallbackUsed = true;
      fallbackReason = 'invalid_response_format';
      result = ruleBasedFallback(txn, velocityData);
    } else {
      result = { ...result, ...toAnalysisContract(result) };
    }
  } catch (err) {
    logger.error({ err, txnId: txn.txnId }, 'Gemini API call failed — using rule-based fallback');
    fallbackUsed = true;
    fallbackReason = err.message;
    result = ruleBasedFallback(txn, velocityData);
  }

  const latencyMs = Date.now() - startTime;
  logger.info({ txnId: txn.txnId, fraudScore: result.fraudScore, latencyMs, fallbackUsed },
    'Fraud analysis complete');

  // Persist explanation to MongoDB
  await ModelExplanation.create({
    explanationId,
    txnId: txn.txnId,
    model: config.gemini.model,
    promptVersion: PROMPT_VERSION,
    latencyMs,
    rawPrompt: config.app.isDev ? fullPrompt : undefined,
    rawResponse: config.app.isDev ? rawResponse : undefined,
    parsedOutput: result,
    fallbackUsed,
    fallbackReason,
  }).catch((err) => logger.error({ err }, 'Failed to persist model explanation'));

  return { ...result, explanationId, latencyMs, fallbackUsed };
}

module.exports = { analyzeFraud, ruleBasedFallback };
