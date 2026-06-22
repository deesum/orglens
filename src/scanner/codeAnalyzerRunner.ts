import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ruleDocUrl } from "../report/ruleDocs.js";
import { AnalyzerFinding, Severity } from "../types/models.js";
import { javaAwareEnv, resolveJavaHome } from "../utils/javaHome.js";
import { runCommand } from "../utils/process.js";
import { inferComponentName, inferMetadataType } from "./inferMetadata.js";
import { runLightweightFallbackScanner } from "./lightweightFallbackScanner.js";

// Salesforce Code Analyzer v5 (`sf code-analyzer run`) JSON output shape.
interface V5Location {
  file?: string;
  startLine?: number;
  startColumn?: number;
}

interface V5Violation {
  rule?: string;
  engine?: string;
  severity?: number;
  tags?: string[];
  message?: string;
  resources?: string[];
  primaryLocationIndex?: number;
  locations?: V5Location[];
}

interface V5Output {
  violations?: V5Violation[];
}

const SCANNER_INSTALL_HINT =
  "Install Salesforce Code Analyzer v5: sf plugins install code-analyzer";

/** v5 severity is 1 (highest) .. 5 (info). */
function mapSeverity(value: number | undefined): Severity {
  switch (value) {
    case 1:
      return "critical";
    case 2:
      return "high";
    case 3:
      return "medium";
    default:
      return "low";
  }
}

/** Derive a scoring category from the rule's tags. */
function categoryFromTags(tags: string[]): string {
  const set = tags.map((t) => t.toLowerCase());
  if (set.some((t) => t.includes("security"))) return "security";
  if (set.some((t) => t.includes("performance"))) return "performance";
  if (set.some((t) => t.includes("errorprone") || t.includes("correctness")))
    return "reliability";
  if (set.some((t) => t.includes("design"))) return "design";
  if (set.some((t) => t.includes("bestpractices") || t.includes("best")))
    return "maintainability";
  if (set.some((t) => t.includes("codestyle") || t.includes("documentation")))
    return "style";
  return "maintainability";
}

function toFinding(v: V5Violation, index: number): AnalyzerFinding {
  const loc = v.locations?.[v.primaryLocationIndex ?? 0] ?? v.locations?.[0];
  const filePath = loc?.file ?? "unknown";
  const metadataType = inferMetadataType(filePath);
  const ruleName = v.rule ?? "UnknownRule";
  // Prefer the engine-provided documentation URL; fall back to our curated map.
  const url =
    (v.resources ?? []).find((r) => /^https?:\/\//.test(r)) ??
    ruleDocUrl({ ruleName, metadataType, engine: v.engine });
  return {
    id: `finding-${index + 1}`,
    ruleName,
    message: (v.message ?? "No message provided").trim(),
    severity: mapSeverity(v.severity),
    category: categoryFromTags(v.tags ?? []),
    filePath,
    componentName: inferComponentName(filePath, metadataType),
    line: loc?.startLine,
    metadataType,
    references: [],
    url,
    engine: v.engine ?? "salesforce-code-analyzer",
  };
}

export interface ScannerRunResult {
  findings: AnalyzerFinding[];
  status: "ok" | "failed" | "not_run";
  message?: string;
}

export interface RunCodeAnalyzerOptions {
  engines?: string[];
}

export function runCodeAnalyzer(
  repoPath: string,
  options: RunCodeAnalyzerOptions = {},
): ScannerRunResult {
  const outFile = path.join(
    os.tmpdir(),
    `orglens-ca-${process.pid}-${Date.now()}.json`,
  );
  const env = javaAwareEnv();
  const javaHome = resolveJavaHome();

  // Exclude our internal lightweight engine from the real scanner selection.
  const selectedEngines = (options.engines ?? []).filter(
    (e) => e && e !== "orglens-lite",
  );

  // v5 selects rules via --rule-selector. Engine names select all of an
  // engine's rules; with no selection we use the curated "Recommended" set.
  const args = [
    "code-analyzer",
    "run",
    "--workspace",
    ".",
    "--output-file",
    outFile,
  ];
  if (selectedEngines.length > 0) {
    for (const engine of selectedEngines) {
      args.push("--rule-selector", engine);
    }
  } else {
    args.push("--rule-selector", "Recommended");
  }

  const command = runCommand("sf", args, repoPath, env);

  // v5 writes the output file even when some engines are skipped (e.g. PMD
  // without Java); a missing file means a real failure.
  if (!fs.existsSync(outFile)) {
    const failureOutput = `${command.stderr}\n${command.stdout}`;
    const javaFailure =
      failureOutput.includes("Unable to locate a Java Runtime") ||
      failureOutput.includes("Could not fetch Java version");
    if (javaFailure) {
      return {
        findings: runLightweightFallbackScanner(repoPath),
        status: "ok",
        message: javaHome
          ? `Salesforce scanner could not use Java at ${javaHome}. Used lightweight fallback checks. Install a JDK 11+ ('brew install openjdk@17').`
          : "No Java runtime found for the Salesforce scanner. Used lightweight fallback checks. Install a JDK 11+ ('brew install openjdk@17').",
      };
    }
    const notInstalled =
      /is not a [\w.]*\s*command|command not found|No plugin found|Cannot find module/i.test(
        failureOutput,
      );
    return {
      findings: notInstalled ? runLightweightFallbackScanner(repoPath) : [],
      status: notInstalled ? "ok" : "failed",
      message: notInstalled
        ? `${SCANNER_INSTALL_HINT}. Used lightweight fallback checks for now.`
        : command.stderr ||
          command.stdout ||
          "Salesforce Code Analyzer command failed.",
    };
  }

  let payload: V5Output;
  try {
    payload = JSON.parse(fs.readFileSync(outFile, "utf8")) as V5Output;
  } catch {
    return {
      findings: [],
      status: "failed",
      message: `Could not parse scanner output at ${outFile}.`,
    };
  } finally {
    try {
      fs.unlinkSync(outFile);
    } catch {
      /* best effort cleanup */
    }
  }

  const findings = (payload.violations ?? []).map(toFinding);
  return { findings, status: "ok" };
}
