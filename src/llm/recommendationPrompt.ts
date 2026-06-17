import { AnalyzerFinding, PrioritizedDebt } from "../types/models.js";

export function buildRecommendationPrompt(
  findings: AnalyzerFinding[],
  topDebts: PrioritizedDebt[],
  maxRecommendations: number,
): string {
  const top = topDebts.slice(0, maxRecommendations);
  const evidence = top
    .map((d) => {
      const finding = findings.find((f) => f.id === d.findingId);
      if (!finding) return "";
      return `ID=${finding.id}; rule=${finding.ruleName}; severity=${finding.severity}; file=${finding.filePath}; message=${finding.message}`;
    })
    .filter(Boolean)
    .join("\n");

  return [
    "You are a Salesforce technical debt advisor.",
    "Return only JSON array where each item has:",
    "title, rationale, impactedArtifacts, evidenceFindingIds, effort, deferredRisk.",
    "Every recommendation must reference one or more evidenceFindingIds present below.",
    "Do not invent IDs.",
    "Evidence:",
    evidence,
  ].join("\n");
}
