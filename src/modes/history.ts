import fs from "node:fs";
import path from "node:path";
import { AgentConfig } from "../config/schema.js";
import { AnalysisResult, HistoryPoint } from "../types/models.js";

const MAX_POINTS = 20;

/**
 * Builds the score history series from governance snapshots, appending the
 * current run so the report can render a trend sparkline.
 */
export function buildHistory(
  current: Pick<AnalysisResult, "score" | "findings" | "timestamp">,
  config: AgentConfig,
  repoPath: string,
): HistoryPoint[] {
  const snapshotDir = path.resolve(repoPath, config.governance.snapshotDir);
  const points: HistoryPoint[] = [];

  if (fs.existsSync(snapshotDir)) {
    const files = fs
      .readdirSync(snapshotDir)
      .filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
      .sort();
    for (const file of files) {
      try {
        const snap = JSON.parse(
          fs.readFileSync(path.join(snapshotDir, file), "utf8"),
        ) as AnalysisResult;
        points.push({
          timestamp: snap.timestamp,
          score: snap.score.overall,
          findingCount: snap.findings.length,
        });
      } catch {
        // Skip unreadable snapshots.
      }
    }
  }

  points.push({
    timestamp: current.timestamp,
    score: current.score.overall,
    findingCount: current.findings.length,
  });

  return points.slice(-MAX_POINTS);
}
