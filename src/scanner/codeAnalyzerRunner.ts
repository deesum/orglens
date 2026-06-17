import fs from "node:fs";
import path from "node:path";
import { AnalyzerFinding } from "../types/models.js";
import { runCommand } from "../utils/process.js";
import { normalizeFindings } from "./normalizeFindings.js";

interface ScannerPayload {
  findings?: Array<Record<string, unknown>>;
}

interface ScannerViolation {
  line?: number;
  severity?: number | string;
  ruleName?: string;
  category?: string;
  message?: string;
}

interface ScannerFileResult {
  fileName?: string;
  violations?: ScannerViolation[];
}

function parseJsonSafely(content: string): ScannerPayload {
  try {
    const parsed = JSON.parse(content) as unknown;

    // v4 scanner output often returns an array by engine:
    // [{ engine, fileName, violations: [...] }]
    if (Array.isArray(parsed)) {
      const flattened: Array<Record<string, unknown>> = [];
      for (const item of parsed as ScannerFileResult[]) {
        const fileName = item.fileName ?? "unknown";
        for (const violation of item.violations ?? []) {
          flattened.push({
            fileName,
            line: violation.line,
            severity: violation.severity,
            ruleName: violation.ruleName,
            category: violation.category,
            message: violation.message,
          });
        }
      }
      return { findings: flattened };
    }

    return parsed as ScannerPayload;
  } catch {
    return {};
  }
}

export interface ScannerRunResult {
  findings: AnalyzerFinding[];
  status: "ok" | "failed" | "not_run";
  message?: string;
}

export function runCodeAnalyzer(repoPath: string): ScannerRunResult {
  const outFile = path.join(repoPath, ".cre-scanner-output.json");

  const command = runCommand(
    "sf",
    ["scanner", "run", "--target", repoPath, "--format", "json", "--outfile", outFile],
    repoPath,
  );

  if (!command.ok) {
    return {
      findings: [],
      status: "failed",
      message: command.stderr || command.stdout || "Salesforce scanner command failed.",
    };
  }

  if (!fs.existsSync(outFile)) {
    return {
      findings: [],
      status: "failed",
      message: `Scanner output file not found at ${outFile}.`,
    };
  }

  const payload = parseJsonSafely(fs.readFileSync(outFile, "utf8"));
  const findings = (payload.findings ?? []) as Array<Record<string, unknown>>;
  return {
    findings: normalizeFindings(findings as never[]),
    status: "ok",
  };
}
