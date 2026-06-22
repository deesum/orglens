import {
  AvailableRule,
  EngineInfo,
  EngineStatus,
} from "../../types/models.js";
import { gitleaksAdapter } from "./gitleaks.js";
import { npmAuditAdapter } from "./npmAudit.js";
import { semgrepAdapter } from "./semgrep.js";
import { ScannerAdapter } from "./types.js";

/**
 * Registered external scan engines. Add a new tool by implementing
 * `ScannerAdapter` and appending it here — it will automatically appear in the
 * Engines panel, the rules catalog, and contribute to the combined Health
 * Score.
 */
export const ADAPTERS: ScannerAdapter[] = [
  semgrepAdapter,
  gitleaksAdapter,
  npmAuditAdapter,
];

export function getAdapter(id: string): ScannerAdapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}

/** Engine metadata (with live install status) for each registered adapter. */
export function adapterEngineInfos(): EngineInfo[] {
  return ADAPTERS.map((adapter) => {
    const detected = adapter.detect();
    const status: EngineStatus = detected.available
      ? "available"
      : "not_installed";
    return {
      id: adapter.id,
      name: adapter.name,
      description: adapter.description,
      languages: adapter.languages,
      requiresJava: adapter.requiresJava,
      status,
      available: detected.available,
      ruleCount: adapter.rules().length,
      installHint: detected.available
        ? undefined
        : (detected.reason ?? adapter.installHint),
    };
  });
}

/** Representative rules contributed by all adapters for the catalog/UI. */
export function adapterRules(): AvailableRule[] {
  return ADAPTERS.flatMap((adapter) => adapter.rules());
}
