import { AvailableRule, Severity } from "../../types/models.js";
import { runCommand } from "../../utils/process.js";
import {
  AdapterContext,
  AdapterDetectResult,
  AdapterRunResult,
  ScannerAdapter,
} from "./types.js";
import { buildFinding, toolAvailable } from "./util.js";

const ENGINE_ID = "semgrep";
const INSTALL_HINT =
  "Install Semgrep: 'brew install semgrep' or 'pip install semgrep' (https://semgrep.dev/docs/getting-started).";

interface SemgrepResult {
  check_id?: string;
  path?: string;
  start?: { line?: number };
  extra?: {
    message?: string;
    severity?: string;
    metadata?: {
      category?: string;
      references?: string[];
      shortlink?: string;
    };
  };
}

interface SemgrepOutput {
  results?: SemgrepResult[];
  errors?: Array<{ message?: string }>;
}

function mapSeverity(raw: string | undefined): Severity {
  switch ((raw ?? "").toUpperCase()) {
    case "ERROR":
      return "high";
    case "WARNING":
      return "medium";
    case "INFO":
      return "low";
    default:
      return "medium";
  }
}

function mapCategory(raw: string | undefined): string {
  const c = (raw ?? "").toLowerCase();
  if (c.includes("security")) return "security";
  if (c.includes("performance")) return "performance";
  if (c.includes("correctness")) return "reliability";
  if (c.includes("best-practice") || c.includes("maintainability"))
    return "maintainability";
  return "security";
}

export const semgrepAdapter: ScannerAdapter = {
  id: ENGINE_ID,
  name: "Semgrep",
  description:
    "Fast SAST with community + custom rules for JS/TS/Apex patterns and OWASP issues.",
  languages: ["javascript", "typescript", "apex"],
  requiresJava: false,
  runByDefault: true,
  installHint: INSTALL_HINT,

  rules(): AvailableRule[] {
    const base = {
      engine: ENGINE_ID,
      categories: ["security"],
      languages: ["javascript", "typescript", "apex"],
      defaultEnabled: true,
      isPilot: false,
      url: "https://semgrep.dev/explore",
    };
    return [
      {
        ...base,
        ruleName: "semgrep.auto.security",
        category: "security",
        defaultSeverity: "high",
      },
      {
        ...base,
        ruleName: "semgrep.auto.correctness",
        category: "reliability",
        categories: ["correctness"],
        defaultSeverity: "high",
      },
      {
        ...base,
        ruleName: "semgrep.auto.best-practice",
        category: "maintainability",
        categories: ["best-practice"],
        defaultSeverity: "medium",
      },
    ];
  },

  detect(): AdapterDetectResult {
    const available = toolAvailable("semgrep", ["--version"]);
    return available ? { available } : { available, reason: INSTALL_HINT };
  },

  isApplicable(): boolean {
    return true;
  },

  run(ctx: AdapterContext): AdapterRunResult {
    const config = process.env.ORGLENS_SEMGREP_CONFIG || "auto";
    const result = runCommand(
      "semgrep",
      [
        "scan",
        "--json",
        "--quiet",
        "--disable-version-check",
        "--config",
        config,
        ctx.repoPath,
      ],
      ctx.repoPath,
    );

    let parsed: SemgrepOutput;
    try {
      parsed = JSON.parse(result.stdout) as SemgrepOutput;
    } catch {
      return {
        findings: [],
        status: "failed",
        message:
          result.stderr.split("\n").find(Boolean) ||
          "Semgrep produced no parseable JSON output. With '--config auto' it needs network access; set ORGLENS_SEMGREP_CONFIG to a local ruleset for offline use.",
      };
    }

    const findings = (parsed.results ?? []).map((r, index) =>
      buildFinding({
        id: `${ENGINE_ID}-${index + 1}`,
        engine: ENGINE_ID,
        ruleName: r.check_id ?? "semgrep.rule",
        message: r.extra?.message ?? "Semgrep finding.",
        severity: mapSeverity(r.extra?.severity),
        category: mapCategory(r.extra?.metadata?.category),
        filePath: r.path ?? "unknown",
        line: r.start?.line,
        url: r.extra?.metadata?.shortlink,
      }),
    );

    return { findings, status: "ok" };
  },
};
