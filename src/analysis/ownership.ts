import { AgentConfig } from "../config/schema.js";
import {
  AnalyzerFinding,
  OwnershipBucket,
  PrioritizedDebt,
} from "../types/models.js";

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replaceAll("\\", "/")
    .replace(/[.+^${}()|[\]]/g, "\\$&")
    .replaceAll("**", "\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", ".*");
  return new RegExp(escaped);
}

/** Resolve the owning team for a finding based on configured path-glob rules. */
export function assignOwner(
  finding: AnalyzerFinding,
  config: AgentConfig,
): string {
  const normalized = finding.filePath.replaceAll("\\", "/");
  for (const rule of config.ownership.rules) {
    try {
      if (globToRegExp(rule.pattern).test(normalized)) return rule.owner;
    } catch {
      // Skip malformed patterns rather than failing the whole run.
    }
  }
  return config.ownership.defaultOwner;
}

export function buildOwnership(
  findings: AnalyzerFinding[],
  topDebts: PrioritizedDebt[],
  config: AgentConfig,
): OwnershipBucket[] {
  const effortPointsByFinding = new Map<string, number>();
  for (const debt of topDebts) {
    effortPointsByFinding.set(
      debt.findingId,
      config.roadmap.effortPoints[debt.effort],
    );
  }

  const buckets = new Map<
    string,
    {
      findingCount: number;
      critical: number;
      high: number;
      effortPoints: number;
      rules: Map<string, number>;
    }
  >();

  for (const finding of findings) {
    const owner = assignOwner(finding, config);
    const bucket =
      buckets.get(owner) ??
      buckets
        .set(owner, {
          findingCount: 0,
          critical: 0,
          high: 0,
          effortPoints: 0,
          rules: new Map(),
        })
        .get(owner)!;
    bucket.findingCount += 1;
    if (finding.severity === "critical") bucket.critical += 1;
    if (finding.severity === "high") bucket.high += 1;
    bucket.effortPoints +=
      effortPointsByFinding.get(finding.id) ?? config.roadmap.effortPoints.M;
    bucket.rules.set(
      finding.ruleName,
      (bucket.rules.get(finding.ruleName) ?? 0) + 1,
    );
  }

  return [...buckets.entries()]
    .map(([owner, b]) => ({
      owner,
      findingCount: b.findingCount,
      critical: b.critical,
      high: b.high,
      effortPoints: b.effortPoints,
      topRules: [...b.rules.entries()]
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([rule, count]) => ({ rule, count })),
    }))
    .sort((a, b) => b.critical - a.critical || b.findingCount - a.findingCount);
}
