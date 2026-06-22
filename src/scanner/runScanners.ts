import { AnalyzerFinding } from "../types/models.js";
import { ADAPTERS } from "./adapters/registry.js";
import { runCodeAnalyzer } from "./codeAnalyzerRunner.js";
import { isSfEngine, LITE_ENGINE_ID } from "./engines.js";

export interface EngineRunSummary {
  engine: string;
  status: "ok" | "failed" | "skipped" | "not_run";
  findingCount: number;
  message?: string;
}

export interface CombinedScanResult {
  findings: AnalyzerFinding[];
  status: "ok" | "failed" | "not_run";
  message?: string;
  engineRuns: EngineRunSummary[];
}

export interface RunAllScannersOptions {
  engines?: string[];
}

const SF_LABEL = "Salesforce Code Analyzer";

function summarize(runs: EngineRunSummary[]): string {
  return (
    "Engines — " +
    runs
      .map((r) => {
        const label = r.engine === "sf" ? SF_LABEL : r.engine;
        if (r.status === "ok") return `${label}: ok (${r.findingCount})`;
        if (r.status === "skipped")
          return `${label}: skipped${r.message ? ` (${r.message})` : ""}`;
        if (r.status === "failed")
          return `${label}: failed${r.message ? ` (${r.message})` : ""}`;
        return `${label}: not run`;
      })
      .join("; ")
  );
}

/**
 * Runs every selected scan engine — the Salesforce Code Analyzer (PMD/ESLint/
 * SFGE, with the built-in lightweight fallback) plus any registered external
 * adapters (Semgrep, Gitleaks, npm audit, ...) — and merges their normalized
 * findings into a single result that feeds one combined Health Score.
 *
 * Selection rules:
 * - No `engines` passed → run the Salesforce analyzer (all engines) and every
 *   adapter whose `runByDefault` is true and that is installed + applicable.
 * - `engines` passed → run only the chosen engines (SF engine ids go to the
 *   Salesforce analyzer; adapter ids run their adapter).
 */
export function runAllScanners(
  repoPath: string,
  options: RunAllScannersOptions = {},
): CombinedScanResult {
  const selection = (options.engines ?? []).filter(Boolean);
  const hasSelection = selection.length > 0;
  const engineRuns: EngineRunSummary[] = [];
  const findings: AnalyzerFinding[] = [];

  const selectedSf = hasSelection ? selection.filter(isSfEngine) : undefined;
  const runSf =
    !hasSelection ||
    (selectedSf?.length ?? 0) > 0 ||
    selection.includes(LITE_ENGINE_ID);

  let sfStatus: CombinedScanResult["status"] = "not_run";
  if (runSf) {
    const sf = runCodeAnalyzer(repoPath, { engines: selectedSf });
    sfStatus = sf.status;
    findings.push(...sf.findings);
    engineRuns.push({
      engine: "sf",
      status: sf.status === "not_run" ? "not_run" : sf.status,
      findingCount: sf.findings.length,
      message: sf.message,
    });
  }

  for (const adapter of ADAPTERS) {
    const wanted = hasSelection
      ? selection.includes(adapter.id)
      : adapter.runByDefault;
    if (!wanted) continue;

    if (!adapter.isApplicable({ repoPath })) {
      engineRuns.push({
        engine: adapter.id,
        status: "skipped",
        findingCount: 0,
        message: "not applicable to this project",
      });
      continue;
    }

    const detected = adapter.detect();
    if (!detected.available) {
      engineRuns.push({
        engine: adapter.id,
        status: "skipped",
        findingCount: 0,
        message: detected.reason ?? adapter.installHint,
      });
      continue;
    }

    try {
      const result = adapter.run({ repoPath });
      findings.push(...result.findings);
      engineRuns.push({
        engine: adapter.id,
        status: result.status,
        findingCount: result.findings.length,
        message: result.message,
      });
    } catch (error) {
      engineRuns.push({
        engine: adapter.id,
        status: "failed",
        findingCount: 0,
        message: error instanceof Error ? error.message : `${error}`,
      });
    }
  }

  const anyOk = engineRuns.some((r) => r.status === "ok");
  let status: CombinedScanResult["status"];
  if (engineRuns.length === 0) {
    status = "not_run";
  } else if (anyOk || engineRuns.some((r) => r.status === "skipped")) {
    status = "ok";
  } else if (runSf && sfStatus === "failed") {
    status = "failed";
  } else {
    status = "failed";
  }

  return {
    findings,
    status,
    message: summarize(engineRuns),
    engineRuns,
  };
}
