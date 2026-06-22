import fs from "node:fs";
import path from "node:path";
import { AvailableRule, Severity } from "../../types/models.js";
import { runCommand } from "../../utils/process.js";
import {
  AdapterContext,
  AdapterDetectResult,
  AdapterRunResult,
  ScannerAdapter,
} from "./types.js";
import { buildFinding, toolAvailable } from "./util.js";

const ENGINE_ID = "npm-audit";
const INSTALL_HINT =
  "Requires npm (ships with Node.js) and a package-lock.json in the project.";

interface NpmAuditVia {
  title?: string;
  url?: string;
  severity?: string;
}

interface NpmAuditVulnerability {
  name?: string;
  severity?: string;
  via?: Array<NpmAuditVia | string>;
  range?: string;
}

interface NpmAuditOutput {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
  error?: { code?: string; summary?: string };
}

function mapSeverity(raw: string | undefined): Severity {
  switch ((raw ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "moderate":
      return "medium";
    default:
      return "low";
  }
}

export const npmAuditAdapter: ScannerAdapter = {
  id: ENGINE_ID,
  name: "npm audit",
  description:
    "Dependency vulnerability scanning (CVEs) for Node.js packages via the npm registry.",
  languages: ["javascript", "typescript"],
  requiresJava: false,
  runByDefault: true,
  installHint: INSTALL_HINT,

  rules(): AvailableRule[] {
    return (["critical", "high", "medium", "low"] as Severity[]).map((sev) => ({
      ruleName: `npm-audit/${sev}-vulnerability`,
      engine: ENGINE_ID,
      category: "security",
      categories: ["dependencies", "vulnerability"],
      languages: ["javascript", "typescript"],
      defaultSeverity: sev,
      defaultEnabled: true,
      isPilot: false,
      url: "https://docs.npmjs.com/cli/commands/npm-audit",
    }));
  },

  detect(): AdapterDetectResult {
    const available = toolAvailable("npm", ["--version"]);
    return available ? { available } : { available, reason: INSTALL_HINT };
  },

  isApplicable(ctx: AdapterContext): boolean {
    return fs.existsSync(path.join(ctx.repoPath, "package.json"));
  },

  run(ctx: AdapterContext): AdapterRunResult {
    const hasLock =
      fs.existsSync(path.join(ctx.repoPath, "package-lock.json")) ||
      fs.existsSync(path.join(ctx.repoPath, "npm-shrinkwrap.json"));
    if (!hasLock) {
      return {
        findings: [],
        status: "skipped",
        message:
          "No package-lock.json found — run 'npm install' to generate one, then npm audit can scan dependencies.",
      };
    }

    // npm audit exits non-zero when vulnerabilities exist; parse stdout anyway.
    const result = runCommand(
      "npm",
      ["audit", "--json"],
      ctx.repoPath,
    );

    let parsed: NpmAuditOutput;
    try {
      parsed = JSON.parse(result.stdout) as NpmAuditOutput;
    } catch {
      return {
        findings: [],
        status: "failed",
        message:
          result.stderr.split("\n").find(Boolean) ||
          "npm audit produced no parseable JSON (it needs network access to the registry).",
      };
    }

    if (parsed.error) {
      return {
        findings: [],
        status: "failed",
        message: parsed.error.summary ?? `npm audit error: ${parsed.error.code}`,
      };
    }

    const vulns = parsed.vulnerabilities ?? {};
    const findings = Object.entries(vulns).map(([name, v], index) => {
      const advisory = (v.via ?? []).find(
        (entry): entry is NpmAuditVia => typeof entry === "object",
      );
      const title = advisory?.title ?? `Vulnerable dependency: ${name}`;
      return buildFinding({
        id: `${ENGINE_ID}-${index + 1}`,
        engine: ENGINE_ID,
        ruleName: `npm-audit/${(v.severity ?? "low").toLowerCase()}-vulnerability`,
        message: `${title}${v.range ? ` (affected range ${v.range})` : ""}`,
        severity: mapSeverity(v.severity),
        category: "security",
        filePath: path.join(ctx.repoPath, "package.json"),
        url: advisory?.url ?? "https://docs.npmjs.com/cli/commands/npm-audit",
      });
    });

    return { findings, status: "ok" };
  },
};
