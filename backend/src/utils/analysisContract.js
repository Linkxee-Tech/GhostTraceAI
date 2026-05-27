'use strict';

function scoreToCategory(score) {
  if (score >= 90) return 'account_takeover_or_coordinated_fraud';
  if (score >= 80) return 'high_confidence_fraud';
  if (score >= 65) return 'suspicious_behavior';
  if (score >= 50) return 'needs_review';
  return 'normal';
}

function toAnalysisContract(result) {
  return {
    riskScore: result.fraudScore,
    fraudCategory: scoreToCategory(result.fraudScore),
    confidence: result.confidence,
    recommendedAction: result.recommendedAction,
    reasoning: result.reasoning || [],
    explanation: result.explanation,
    anomalies: result.anomalies || [],
  };
}

module.exports = { scoreToCategory, toAnalysisContract };

