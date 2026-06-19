import { AgentConfig } from "../config/schema.js";
import { ruleDocUrl } from "../report/ruleDocs.js";
import {
  AnalyzerFinding,
  RuleCatalogEntry,
  Severity,
} from "../types/models.js";

const VALID_SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export interface ResolvedRuleOverrides {
  disabled: Set<string>;
  severity: Map<string, Severity>;
}

function toSeverity(value: unknown): Severity | undefined {
  const normalized = `${value ?? ""}`.toLowerCase();
  return (VALID_SEVERITIES as string[]).includes(normalized)
    ? (normalized as Severity)
    : undefined;
}

/** Merge config-level overrides with per-run CLI/UI options (options win). */
export function resolveRuleOverrides(
  config: AgentConfig,
  options: {
    disabledRules?: string[];
    severityOverrides?: Record<string, string>;
  },
): ResolvedRuleOverrides {
  const disabled = new Set<string>([
    ...config.ruleOverrides.disabled,
    ...(options.disabledRules ?? []),
  ]);

  const severity = new Map<string, Severity>();
  for (const [rule, sev] of Object.entries(config.ruleOverrides.severity)) {
    const parsed = toSeverity(sev);
    if (parsed) severity.set(rule, parsed);
  }
  for (const [rule, sev] of Object.entries(options.severityOverrides ?? {})) {
    const parsed = toSeverity(sev);
    if (parsed) severity.set(rule, parsed);
  }

  return { disabled, severity };
}

/** Drop disabled rules and remap severities before scoring/ranking. */
export function applyRuleOverrides(
  findings: AnalyzerFinding[],
  overrides: ResolvedRuleOverrides,
): AnalyzerFinding[] {
  return findings
    .filter((f) => !overrides.disabled.has(f.ruleName))
    .map((f) => {
      const override = overrides.severity.get(f.ruleName);
      return override ? { ...f, severity: override } : f;
    });
}

/**
 * Builds a catalog of every rule that fired, with its default severity, count,
 * affected metadata types, and a documentation link — used by the rules panel
 * and the `orglens rules` command.
 */
export function buildRuleCatalog(
  findings: AnalyzerFinding[],
): RuleCatalogEntry[] {
  const map = new Map<
    string,
    {
      category: string;
      severity: Severity;
      count: number;
      types: Set<string>;
      sample: AnalyzerFinding;
    }
  >();

  for (const f of findings) {
    const cur = map.get(f.ruleName);
    if (!cur) {
      map.set(f.ruleName, {
        category: f.category,
        severity: f.severity,
        count: 1,
        types: new Set([f.metadataType]),
        sample: f,
      });
    } else {
      cur.count += 1;
      cur.types.add(f.metadataType);
      // Keep the most severe seen as the representative default.
      if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[cur.severity])
        cur.severity = f.severity;
    }
  }

  return [...map.entries()]
    .map(([ruleName, data]) => ({
      ruleName,
      category: data.category,
      defaultSeverity: data.severity,
      count: data.count,
      metadataTypes: [...data.types].sort(),
      url:
        data.sample.url && /^https?:\/\//.test(data.sample.url)
          ? data.sample.url
          : ruleDocUrl(data.sample),
    }))
    .sort((a, b) => b.count - a.count || a.ruleName.localeCompare(b.ruleName));
}
