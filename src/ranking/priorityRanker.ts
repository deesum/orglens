import { AgentConfig } from "../config/schema.js";
import { AnalyzerFinding, PrioritizedDebt } from "../types/models.js";

function severityWeight(severity: AnalyzerFinding["severity"]): number {
  switch (severity) {
    case "critical":
      return 100;
    case "high":
      return 75;
    case "medium":
      return 45;
    default:
      return 20;
  }
}

function effortForFinding(finding: AnalyzerFinding): "S" | "M" | "L" {
  const length = finding.message.length;
  if (length < 80) return "S";
  if (length < 180) return "M";
  return "L";
}

function effortWeight(effort: "S" | "M" | "L"): number {
  if (effort === "S") return 100;
  if (effort === "M") return 60;
  return 30;
}

export function rankDebts(
  findings: AnalyzerFinding[],
  blastRadiusMap: Map<string, number>,
  config: AgentConfig,
): PrioritizedDebt[] {
  return findings
    .map((finding) => {
      const blastRadius = blastRadiusMap.get(finding.id) ?? 0;
      const effort = effortForFinding(finding);
      const priorityScore =
        severityWeight(finding.severity) * config.priority.severityWeight +
        blastRadius * config.priority.blastRadiusWeight +
        effortWeight(effort) * config.priority.effortWeight;

      return {
        findingId: finding.id,
        priorityScore: Math.round(priorityScore),
        effort,
        blastRadius,
        fixNowReason: `${finding.severity.toUpperCase()} severity with blast radius ${blastRadius}.`,
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
