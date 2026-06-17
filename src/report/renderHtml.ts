import { AnalysisResult } from "../types/models.js";
import { recommendedFixForFinding } from "./fixGuidance.js";

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderHtml(result: AnalysisResult): string {
  const findingsById = new Map(result.findings.map((f) => [f.id, f]));
  const ruleSummaryMap = new Map<string, { count: number; severity: string; files: Set<string> }>();
  for (const finding of result.findings) {
    const current = ruleSummaryMap.get(finding.ruleName) ?? {
      count: 0,
      severity: finding.severity.toUpperCase(),
      files: new Set<string>(),
    };
    current.count += 1;
    current.files.add(finding.filePath);
    if (finding.severity === "critical") current.severity = "CRITICAL";
    else if (finding.severity === "high" && current.severity !== "CRITICAL") current.severity = "HIGH";
    else if (
      finding.severity === "medium" &&
      current.severity !== "CRITICAL" &&
      current.severity !== "HIGH"
    ) {
      current.severity = "MEDIUM";
    }
    ruleSummaryMap.set(finding.ruleName, current);
  }
  const ruleSummaryRows = [...ruleSummaryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(
      ([rule, data]) =>
        `<tr><td>${escapeHtml(rule)}</td><td>${data.count}</td><td>${escapeHtml(data.severity)}</td><td>${escapeHtml(
          [...data.files].slice(0, 3).join(", "),
        )}</td></tr>`,
    )
    .join("");

  const debtRows = result.topDebts
    .slice(0, 10)
    .map((d) => {
      const finding = findingsById.get(d.findingId);
      const where = finding ? `${finding.filePath}${finding.line ? `:${finding.line}` : ""}` : "unknown";
      const what = finding ? `${finding.ruleName} - ${finding.message}` : d.findingId;
      const why = finding
        ? `${finding.severity.toUpperCase()} severity in ${finding.category} with blast radius ${d.blastRadius}.`
        : d.fixNowReason;
      const fix = finding ? recommendedFixForFinding(finding) : "Review finding details and apply rule guidance.";
      return `<tr>
        <td>${escapeHtml(d.findingId)}</td>
        <td>${d.priorityScore}</td>
        <td>${d.effort}</td>
        <td>${escapeHtml(what)}</td>
        <td>${escapeHtml(where)}</td>
        <td>${escapeHtml(why)}</td>
        <td>${escapeHtml(fix)}</td>
      </tr>`;
    })
    .join("");

  const recommendations = result.recommendations
    .map(
      (r) =>
        `<li><strong>${escapeHtml(r.title)}</strong>: ${escapeHtml(r.rationale)}<br/>` +
        `Evidence: ${escapeHtml(r.evidenceFindingIds.join(", "))}<br/>` +
        `Impacted: ${escapeHtml(r.impactedArtifacts.join(", "))}<br/>` +
        `Effort: ${r.effort}, Deferred Risk: ${escapeHtml(r.deferredRisk)}</li>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>CRE Report</title></head>
<body>
  <h1>Config Reverse Engineer Report</h1>
  <p>Scanner Status: <strong>${result.scannerStatus}</strong></p>
  <p>Scanner Message: <strong>${escapeHtml(result.scannerMessage ?? "n/a")}</strong></p>
  <p>Health Score: <strong>${result.score.overall}</strong></p>
  <p>Confidence: <strong>${result.score.confidence}%</strong></p>
  <h2>Top Debt Items</h2>
  <table border="1" cellpadding="6" cellspacing="0">
    <tr><th>Finding</th><th>Priority</th><th>Effort</th><th>What</th><th>Where</th><th>Why</th><th>How To Fix</th></tr>
    ${debtRows}
  </table>
  <h2>Recommendations</h2>
  <ul>${recommendations}</ul>
  <h2>Summary By Rule</h2>
  <table border="1" cellpadding="6" cellspacing="0">
    <tr><th>Rule</th><th>Count</th><th>Max Severity</th><th>Example Files</th></tr>
    ${ruleSummaryRows}
  </table>
  <h2>Dependency Impact</h2>
  <p>Nodes: ${result.graph.nodes.length}, Edges: ${result.graph.edges.length}</p>
</body>
</html>`;
}
