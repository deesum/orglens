import { Recommendation } from "../types/models.js";

export function validateRecommendations(
  raw: unknown,
  validFindingIds: Set<string>,
): Recommendation[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((r) => typeof r === "object" && r !== null)
    .map((r) => r as Record<string, unknown>)
    .map((r) => {
      const evidenceFindingIds = Array.isArray(r.evidenceFindingIds)
        ? (r.evidenceFindingIds as string[]).filter((id) =>
            validFindingIds.has(id),
          )
        : [];
      const effort: "S" | "M" | "L" =
        r.effort === "S" || r.effort === "M" || r.effort === "L"
          ? r.effort
          : "M";

      return {
        title: `${r.title ?? "Recommendation"}`,
        rationale: `${r.rationale ?? "No rationale provided."}`,
        impactedArtifacts: Array.isArray(r.impactedArtifacts)
          ? (r.impactedArtifacts as string[]).map((v) => `${v}`)
          : [],
        evidenceFindingIds,
        effort,
        deferredRisk: `${r.deferredRisk ?? "Risk not specified."}`,
      };
    })
    .filter((r) => r.evidenceFindingIds.length > 0);
}
