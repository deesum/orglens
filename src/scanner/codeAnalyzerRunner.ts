import fs from "node:fs";
import path from "node:path";
import { AnalyzerFinding } from "../types/models.js";
import { runCommand } from "../utils/process.js";
import { normalizeFindings } from "./normalizeFindings.js";

interface ScannerPayload {
  findings?: Array<Record<string, unknown>>;
}

function parseJsonSafely(content: string): ScannerPayload {
  try {
    return JSON.parse(content) as ScannerPayload;
  } catch {
    return {};
  }
}

export function runCodeAnalyzer(repoPath: string): AnalyzerFinding[] {
  const outFile = path.join(repoPath, ".cre-scanner-output.json");

  const command = runCommand(
    "sf",
    ["scanner", "run", "--target", repoPath, "--format", "json", "--outfile", outFile],
    repoPath,
  );

  if (!command.ok) {
    return [];
  }

  if (!fs.existsSync(outFile)) {
    return [];
  }

  const payload = parseJsonSafely(fs.readFileSync(outFile, "utf8"));
  const findings = (payload.findings ?? []) as Array<Record<string, unknown>>;
  return normalizeFindings(findings as never[]);
}
