import fs from "node:fs";
import path from "node:path";
import { AnalysisResult, BacklogItem } from "../types/models.js";

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildBacklogItems(
  result: Pick<AnalysisResult, "topDebts" | "findings" | "recommendations">,
  ownerTeam: string,
  releaseTrain: string,
): BacklogItem[] {
  const findingMap = new Map(result.findings.map((f) => [f.id, f]));
  const recommendationMap = new Map(
    result.recommendations.flatMap((r) => r.evidenceFindingIds.map((id) => [id, r.rationale] as const)),
  );

  return result.topDebts.map((debt, idx) => {
    const finding = findingMap.get(debt.findingId);
    const severity = finding?.severity ?? "medium";
    const componentPath = finding?.filePath ?? "unknown";
    const recommendation = recommendationMap.get(debt.findingId) ?? debt.fixNowReason;
    return {
      key: `CRE-${idx + 1}`,
      title: `${finding?.ruleName ?? debt.findingId} in ${path.basename(componentPath)}`,
      description: finding?.message ?? debt.fixNowReason,
      severity,
      priorityScore: debt.priorityScore,
      effort: debt.effort,
      ownerTeam,
      releaseTrain,
      componentPath,
      recommendation,
      jiraLabels: ["config-reverse-engineer", `severity-${severity}`, `effort-${debt.effort.toLowerCase()}`],
    };
  });
}

export function writeBacklogCsv(backlog: BacklogItem[], outputPath: string): string {
  const header = [
    "IssueKey",
    "Summary",
    "Description",
    "Severity",
    "PriorityScore",
    "Effort",
    "OwnerTeam",
    "ReleaseTrain",
    "ComponentPath",
    "Recommendation",
    "Labels",
  ];
  const rows = backlog.map((item) => [
    item.key,
    item.title,
    item.description,
    item.severity,
    `${item.priorityScore}`,
    item.effort,
    item.ownerTeam,
    item.releaseTrain,
    item.componentPath,
    item.recommendation,
    item.jiraLabels.join(" "),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((v) => csvEscape(v)).join(","))
    .join("\n");
  fs.writeFileSync(outputPath, csv, "utf8");
  return outputPath;
}
