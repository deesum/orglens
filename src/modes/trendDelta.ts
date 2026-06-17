import fs from "node:fs";
import path from "node:path";
import { AgentConfig } from "../config/schema.js";
import { AnalysisResult, TrendDelta } from "../types/models.js";

function latestSnapshotFile(snapshotDir: string): string | undefined {
  if (!fs.existsSync(snapshotDir)) return undefined;
  const files = fs
    .readdirSync(snapshotDir)
    .filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
    .sort();
  if (files.length === 0) return undefined;
  return path.join(snapshotDir, files[files.length - 1]);
}

export function computeTrendDelta(
  current: Pick<AnalysisResult, "score" | "findings">,
  config: AgentConfig,
  repoPath: string,
): TrendDelta {
  const snapshotDir = path.resolve(repoPath, config.governance.snapshotDir);
  const snapshot = latestSnapshotFile(snapshotDir);
  if (!snapshot) {
    return { status: "no_baseline" };
  }

  try {
    const previous = JSON.parse(fs.readFileSync(snapshot, "utf8")) as AnalysisResult;
    const scoreDelta = current.score.overall - previous.score.overall;
    const findingDelta = current.findings.length - previous.findings.length;
    let status: TrendDelta["status"] = "unchanged";
    if (scoreDelta > 0 || findingDelta < 0) status = "improved";
    if (scoreDelta < 0 || findingDelta > 0) status = "regressed";
    return {
      previousSnapshotFile: snapshot,
      previousScore: previous.score.overall,
      scoreDelta,
      previousFindingCount: previous.findings.length,
      findingDelta,
      status,
    };
  } catch {
    return { status: "no_baseline" };
  }
}
