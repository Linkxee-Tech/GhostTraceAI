/**
 * GhostTrace AI — Shared Type Definitions
 * JSDoc typedefs used across backend services for editor intellisense.
 * @module shared/types
 */

/**
 * @typedef {Object} TransactionDoc
 * @property {string} txnId
 * @property {string} accountId
 * @property {number} amount
 * @property {string} currency
 * @property {string} type
 * @property {string} channel
 * @property {string} status
 * @property {Object} [merchant]
 * @property {Object} [device]
 * @property {Object} [geo]
 * @property {boolean} agentProcessed
 * @property {number|null} fraudScore
 * @property {number|null} fraudConfidence
 * @property {boolean|null} isFraud
 * @property {string[]} fraudReasons
 * @property {string|null} agentAction
 */

/**
 * @typedef {Object} GeminiAnalysisResult
 * @property {number} fraudScore        - 0-100
 * @property {number} confidence        - 0.0-1.0
 * @property {boolean} isFraud
 * @property {string} recommendedAction - clear|flag|block|freeze|escalate|request_review
 * @property {Array<{factor:string, score:number, description:string}>} riskFactors
 * @property {string} explanation       - Human-readable explanation
 * @property {string[]} reasoning       - Step-by-step reasoning chain
 * @property {string[]} anomalies       - List of detected anomalies
 * @property {string} explanationId
 * @property {number} latencyMs
 * @property {boolean} fallbackUsed
 */

/**
 * @typedef {Object} PreScoreResult
 * @property {number} preScore
 * @property {{ count1min:number, count5min:number, count1hr:number, amtToday:number, velocityScore:number }} velocityData
 * @property {{ geoAnomalyScore:number, distanceKm:number, isAnomaly:boolean }} geoData
 * @property {{ deviceTrustScore:number, issues:string[] }} deviceData
 * @property {{ merchantRiskScore:number }} merchantData
 * @property {{ behavioralDriftScore:number, avgAmount:number, isNewAccount:boolean }} behaviorData
 */

/**
 * @typedef {Object} DashboardStats
 * @property {number} totalToday
 * @property {number} fraudDetected
 * @property {number} pendingReview
 * @property {number} agentDecisions
 * @property {number} avgLatencyMs
 * @property {number} blockedAmount
 * @property {number} accuracy
 * @property {number} threatLevel
 */

module.exports = {};
