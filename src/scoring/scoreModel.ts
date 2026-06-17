import { AgentConfig } from "../config/schema.js";
import { AnalyzerFinding, ScoreResult, ScoringBreakdown } from "../types/models.js";

const categoryMap: Record<string, keyof ScoringBreakdown> = {
  security: "security",
  maintainability: "maintainability",
  style: "maintainability",
  reliability: "reliability",
  performance: "performance",
  design: "operability",
  operability: "operability",
};

function severityPoints(config: AgentConfig, severity: AnalyzerFinding["severity"]): number {
  return config.scoring.severityPoints[severity];
}

export function computeScore(
  findings: AnalyzerFinding[],
  config: AgentConfig,
  confidence: number,
): ScoreResult {
  const penalties: ScoringBreakdown = {
    security: 0,
    maintainability: 0,
    reliability: 0,
    performance: 0,
    operability: 0,
  };

  for (const finding of findings) {
    const mapped = categoryMap[finding.category.toLowerCase()] ?? "maintainability";
    penalties[mapped] += severityPoints(config, finding.severity);
  }

  const breakdown: ScoringBreakdown = {
    security: Math.max(0, 100 - penalties.security),
    maintainability: Math.max(0, 100 - penalties.maintainability),
    reliability: Math.max(0, 100 - penalties.reliability),
    performance: Math.max(0, 100 - penalties.performance),
    operability: Math.max(0, 100 - penalties.operability),
  };

  const weights = config.scoring.weights;
  const overallRaw =
    breakdown.security * weights.security +
    breakdown.maintainability * weights.maintainability +
    breakdown.reliability * weights.reliability +
    breakdown.performance * weights.performance +
    breakdown.operability * weights.operability;

  return {
    overall: Math.round(overallRaw),
    confidence,
    breakdown,
  };
}
