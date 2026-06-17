import { AnalysisResult } from "../types/models.js";
import { recommendedFixForFinding } from "./fixGuidance.js";

export function renderMarkdown(result: AnalysisResult): string {
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
  const ruleSummary = [...ruleSummaryMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(
      ([rule, data], idx) =>
        `${idx + 1}. **${rule}** count=${data.count}, max-severity=${data.severity}, files=${[...data.files]
          .slice(0, 3)
          .join(", ")}`,
    )
    .join("\n");
  const topDebts = result.topDebts
    .slice(0, 10)
    .map((debt, idx) => {
      const finding = findingsById.get(debt.findingId);
      const where = finding ? `${finding.filePath}${finding.line ? `:${finding.line}` : ""}` : "unknown";
      const what = finding ? `${finding.ruleName} - ${finding.message}` : debt.findingId;
      const why = finding
        ? `${finding.severity.toUpperCase()} severity in ${finding.category} with blast radius ${debt.blastRadius}.`
        : debt.fixNowReason;
      const fix = finding ? recommendedFixForFinding(finding) : "Review rule guidance.";
      return `${idx + 1}. **${debt.findingId}** (score=${debt.priorityScore}, effort=${debt.effort})
   - what: ${what}
   - where: ${where}
   - why: ${why}
   - how-to-fix: ${fix}`;
    })
    .join("\n");

  const recommendations = result.recommendations
    .map(
      (r, idx) =>
        `${idx + 1}. **${r.title}**
   - rationale: ${r.rationale}
   - impacted: ${r.impactedArtifacts.join(", ")}
   - evidence: ${r.evidenceFindingIds.join(", ")}
   - effort: ${r.effort}
   - deferred-risk: ${r.deferredRisk}`,
    )
    .join("\n");
  const playbooks = result.playbooks
    .slice(0, 10)
    .map(
      (p, idx) =>
        `${idx + 1}. **${p.findingId}** [${p.domain}] ${p.ruleName}
   - why-priority: ${p.whyPriority}
   - fix-steps: ${p.fixSteps.join(" | ")}
   - verification: ${p.verificationSteps.join(" | ")}`,
    )
    .join("\n");

  return [
    "# Config Reverse Engineer Report",
    "",
    `- Timestamp: ${result.timestamp}`,
    `- Scanner Status: **${result.scannerStatus}**`,
    `- Scanner Message: **${result.scannerMessage ?? "n/a"}**`,
    `- Overall Health Score: **${result.score.overall}**`,
    `- Confidence: **${result.score.confidence}%**`,
    "",
    "## Top Debt Items",
    topDebts || "_No debt items found._",
    "",
    "## Recommendations",
    recommendations || "_No recommendations generated._",
    "",
    "## Trend Delta",
    `- Status: ${result.trend.status}`,
    `- Previous Score: ${result.trend.previousScore ?? "n/a"}`,
    `- Score Delta: ${result.trend.scoreDelta ?? "n/a"}`,
    `- Previous Finding Count: ${result.trend.previousFindingCount ?? "n/a"}`,
    `- Finding Delta: ${result.trend.findingDelta ?? "n/a"}`,
    "",
    "## Domain Playbooks",
    playbooks || "_No playbook entries generated._",
    "",
    "## Summary By Rule",
    ruleSummary || "_No scanner rule findings to summarize._",
    "",
    "## Dependency Impact",
    `- Nodes: ${result.graph.nodes.length}`,
    `- Edges: ${result.graph.edges.length}`,
    "",
    "## Jira Backlog",
    `- Items: ${result.backlog.length}`,
  ].join("\n");
}
