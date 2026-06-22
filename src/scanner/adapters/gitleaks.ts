import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AvailableRule } from "../../types/models.js";
import { runCommand } from "../../utils/process.js";
import {
  AdapterContext,
  AdapterDetectResult,
  AdapterRunResult,
  ScannerAdapter,
} from "./types.js";
import { buildFinding, toolAvailable } from "./util.js";

const ENGINE_ID = "gitleaks";
const INSTALL_HINT =
  "Install Gitleaks: 'brew install gitleaks' (https://github.com/gitleaks/gitleaks).";

interface GitleaksLeak {
  RuleID?: string;
  Description?: string;
  File?: string;
  StartLine?: number;
  Match?: string;
  Secret?: string;
}

const COMMON_RULES: Array<{ id: string; label: string }> = [
  { id: "generic-api-key", label: "Generic API key" },
  { id: "aws-access-token", label: "AWS access token" },
  { id: "private-key", label: "Private key" },
  { id: "gcp-api-key", label: "GCP API key" },
  { id: "github-pat", label: "GitHub personal access token" },
  { id: "slack-access-token", label: "Slack token" },
];

export const gitleaksAdapter: ScannerAdapter = {
  id: ENGINE_ID,
  name: "Gitleaks",
  description:
    "Secret scanning — detects hardcoded keys, tokens, and credentials in source.",
  languages: ["any"],
  requiresJava: false,
  runByDefault: true,
  installHint: INSTALL_HINT,

  rules(): AvailableRule[] {
    return COMMON_RULES.map((r) => ({
      ruleName: r.id,
      engine: ENGINE_ID,
      category: "security",
      categories: ["secrets"],
      languages: ["any"],
      defaultSeverity: "critical",
      defaultEnabled: true,
      isPilot: false,
      url: "https://github.com/gitleaks/gitleaks#rules",
    }));
  },

  detect(): AdapterDetectResult {
    const available =
      toolAvailable("gitleaks", ["version"]) ||
      toolAvailable("gitleaks", ["--version"]);
    return available ? { available } : { available, reason: INSTALL_HINT };
  },

  isApplicable(): boolean {
    return true;
  },

  run(ctx: AdapterContext): AdapterRunResult {
    const reportPath = path.join(
      os.tmpdir(),
      `orglens-gitleaks-${process.pid}-${Date.now()}.json`,
    );
    // `--no-git` scans the working tree (works whether or not it's a git repo);
    // `--exit-code 0` keeps exit status 0 even when leaks are found.
    const result = runCommand(
      "gitleaks",
      [
        "detect",
        "--no-banner",
        "--no-git",
        "--redact",
        "--exit-code",
        "0",
        "--source",
        ctx.repoPath,
        "--report-format",
        "json",
        "--report-path",
        reportPath,
      ],
      ctx.repoPath,
    );

    let leaks: GitleaksLeak[] = [];
    try {
      if (fs.existsSync(reportPath)) {
        const raw = fs.readFileSync(reportPath, "utf8").trim();
        leaks = raw ? (JSON.parse(raw) as GitleaksLeak[]) : [];
        fs.unlinkSync(reportPath);
      }
    } catch {
      return {
        findings: [],
        status: "failed",
        message:
          result.stderr.split("\n").find(Boolean) ||
          "Gitleaks ran but its JSON report could not be parsed.",
      };
    }

    if (!fs.existsSync(reportPath) && leaks.length === 0 && !result.ok) {
      // Distinguish a genuine failure (e.g. unsupported flags) from a clean run.
      const stderr = result.stderr.toLowerCase();
      if (stderr.includes("unknown flag") || stderr.includes("error")) {
        return {
          findings: [],
          status: "failed",
          message:
            result.stderr.split("\n").find(Boolean) || "Gitleaks run failed.",
        };
      }
    }

    const findings = leaks.map((leak, index) =>
      buildFinding({
        id: `${ENGINE_ID}-${index + 1}`,
        engine: ENGINE_ID,
        ruleName: leak.RuleID ?? "secret",
        message:
          (leak.Description ?? "Potential secret detected") +
          (leak.Match ? ` (match: ${leak.Match})` : ""),
        severity: "critical",
        category: "security",
        filePath: leak.File ?? "unknown",
        line: leak.StartLine,
        url: "https://github.com/gitleaks/gitleaks#rules",
      }),
    );

    return { findings, status: "ok" };
  },
};
