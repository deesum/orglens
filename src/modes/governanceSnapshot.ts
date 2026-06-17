import fs from "node:fs";
import path from "node:path";
import { AgentConfig } from "../config/schema.js";
import { AnalysisResult } from "../types/models.js";

export function writeGovernanceSnapshot(result: AnalysisResult, config: AgentConfig, repoPath: string): string {
  const snapshotDir = path.resolve(repoPath, config.governance.snapshotDir);
  fs.mkdirSync(snapshotDir, { recursive: true });
  const fileName = `snapshot-${new Date().toISOString().replaceAll(":", "-")}.json`;
  const target = path.join(snapshotDir, fileName);
  fs.writeFileSync(target, JSON.stringify(result, null, 2), "utf8");
  return target;
}
