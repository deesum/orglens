import { AnalysisResult } from "../types/models.js";

export function renderMarkdown(result: AnalysisResult): string {
  const topDebts = result.topDebts
    .slice(0, 10)
    .map(
      (debt, idx) =>
        `${idx + 1}. **${debt.findingId}** score=${debt.priorityScore}, effort=${debt.effort}, reason=${debt.fixNowReason}`,
    )
    .join("\n");

  const recommendations = result.recommendations
    .map(
      (r, idx) =>
        `${idx + 1}. **${r.title}**\n   - rationale: ${r.rationale}\n   - evidence: ${r.evidenceFindingIds.join(", ")}`,
    )
    .join("\n");

  return [
    "# Config Reverse Engineer Report",
    "",
    `- Timestamp: ${result.timestamp}`,
    `- Overall Health Score: **${result.score.overall}**`,
    `- Confidence: **${result.score.confidence}%**`,
    "",
    "## Top Debt Items",
    topDebts || "_No debt items found._",
    "",
    "## Recommendations",
    recommendations || "_No recommendations generated._",
    "",
    "## Dependency Impact",
    `- Nodes: ${result.graph.nodes.length}`,
    `- Edges: ${result.graph.edges.length}`,
  ].join("\n");
}
