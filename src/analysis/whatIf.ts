import { AgentConfig } from "../config/schema.js";
import { computeScore } from "../scoring/scoreModel.js";
import {
  AnalyzerFinding,
  PrioritizedDebt,
  WhatIfOpportunity,
} from "../types/models.js";
import { deriveComponentName } from "../utils/component.js";

/**
 * Simulates "what-if we fixed group X" by recomputing the health score with the
 * matching findings removed. Groups by rule, by component, and by severity, then
 * returns the highest score-lift opportunities so architects can justify refactors.
 */
export function computeWhatIf(
  findings: AnalyzerFinding[],
  topDebts: PrioritizedDebt[],
  currentScore: number,
  confidence: number,
  config: AgentConfig,
): WhatIfOpportunity[] {
  if (findings.length === 0) return [];

  const effortPointsByFinding = new Map<string, number>();
  for (const debt of topDebts) {
    effortPointsByFinding.set(
      debt.findingId,
      config.roadmap.effortPoints[debt.effort],
    );
  }
  const pointsFor = (id: string): number =>
    effortPointsByFinding.get(id) ?? config.roadmap.effortPoints.M;

  const opportunities: WhatIfOpportunity[] = [];

  const addGroup = (
    kind: WhatIfOpportunity["kind"],
    label: string,
    matched: AnalyzerFinding[],
  ): void => {
    if (matched.length === 0) return;
    const matchedIds = new Set(matched.map((f) => f.id));
    const remaining = findings.filter((f) => !matchedIds.has(f.id));
    const projected = computeScore(remaining, config, confidence).overall;
    const lift = projected - currentScore;
    if (lift <= 0) return;
    opportunities.push({
      kind,
      label,
      findingsResolved: matched.length,
      effortPoints: matched.reduce((sum, f) => sum + pointsFor(f.id), 0),
      projectedScore: projected,
      scoreLift: lift,
    });
  };

  const byRule = new Map<string, AnalyzerFinding[]>();
  const byComponent = new Map<string, AnalyzerFinding[]>();
  const bySeverity = new Map<string, AnalyzerFinding[]>();
  for (const f of findings) {
    (
      byRule.get(f.ruleName) ?? byRule.set(f.ruleName, []).get(f.ruleName)!
    ).push(f);
    const comp = deriveComponentName(f);
    (byComponent.get(comp) ?? byComponent.set(comp, []).get(comp)!).push(f);
    (
      bySeverity.get(f.severity) ??
      bySeverity.set(f.severity, []).get(f.severity)!
    ).push(f);
  }

  for (const [rule, matched] of byRule) addGroup("rule", rule, matched);
  for (const [comp, matched] of byComponent)
    addGroup("component", comp, matched);
  for (const [severity, matched] of bySeverity)
    addGroup("severity", `All ${severity} findings`, matched);

  return opportunities
    .sort(
      (a, b) => b.scoreLift - a.scoreLift || a.effortPoints - b.effortPoints,
    )
    .slice(0, 15);
}
