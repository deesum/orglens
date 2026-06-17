import { AnalysisResult } from "../types/models.js";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderHtml(result: AnalysisResult): string {
  const debtRows = result.topDebts
    .slice(0, 10)
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.findingId)}</td><td>${d.priorityScore}</td><td>${d.effort}</td><td>${escapeHtml(d.fixNowReason)}</td></tr>`,
    )
    .join("");

  const recommendations = result.recommendations
    .map((r) => `<li><strong>${escapeHtml(r.title)}</strong>: ${escapeHtml(r.rationale)}</li>`)
    .join("");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>CRE Report</title></head>
<body>
  <h1>Config Reverse Engineer Report</h1>
  <p>Health Score: <strong>${result.score.overall}</strong></p>
  <p>Confidence: <strong>${result.score.confidence}%</strong></p>
  <h2>Top Debt Items</h2>
  <table border="1" cellpadding="6" cellspacing="0">
    <tr><th>Finding</th><th>Priority</th><th>Effort</th><th>Reason</th></tr>
    ${debtRows}
  </table>
  <h2>Recommendations</h2>
  <ul>${recommendations}</ul>
  <h2>Dependency Impact</h2>
  <p>Nodes: ${result.graph.nodes.length}, Edges: ${result.graph.edges.length}</p>
</body>
</html>`;
}
