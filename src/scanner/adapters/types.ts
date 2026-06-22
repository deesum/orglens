import { AnalyzerFinding, AvailableRule } from "../../types/models.js";

export interface AdapterContext {
  repoPath: string;
}

export interface AdapterDetectResult {
  available: boolean;
  /** Why the tool is unavailable (shown to the user as an install hint). */
  reason?: string;
}

export interface AdapterRunResult {
  findings: AnalyzerFinding[];
  status: "ok" | "failed" | "skipped";
  message?: string;
}

/**
 * A pluggable scan engine. Each external tool (Semgrep, Gitleaks, npm audit,
 * Snyk, CodeQL, SonarQube, ...) implements this interface so it shows up in the
 * same Engines panel and contributes normalized findings to the single Health
 * Score. To add a new tool, implement this interface and register it in
 * `registry.ts`.
 */
export interface ScannerAdapter {
  /** Stable engine id used in the catalog and `--engines` selection. */
  id: string;
  name: string;
  description: string;
  languages: string[];
  requiresJava: boolean;
  /** Run automatically when the user makes no explicit engine selection. */
  runByDefault: boolean;
  /** Shown when the underlying tool isn't installed. */
  installHint: string;
  /** Representative rules surfaced in the catalog/UI rules table. */
  rules(): AvailableRule[];
  /** Whether the underlying CLI is installed and runnable. */
  detect(): AdapterDetectResult;
  /** Whether the adapter applies to this repo (e.g. has a package.json). */
  isApplicable(ctx: AdapterContext): boolean;
  /** Execute the tool and return normalized findings. */
  run(ctx: AdapterContext): AdapterRunResult;
}
