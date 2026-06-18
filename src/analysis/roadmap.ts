import { AgentConfig } from "../config/schema.js";
import { computeScore } from "../scoring/scoreModel.js";
import {
  AnalyzerFinding,
  PrioritizedDebt,
  RoadmapSprint,
} from "../types/models.js";

const MAX_SPRINTS = 8;

/**
 * Packs prioritized debt into effort-weighted sprints (greedy, highest priority
 * first) and projects the cumulative health score after each sprint completes.
 */
export function buildRoadmap(
  topDebts: PrioritizedDebt[],
  findings: AnalyzerFinding[],
  confidence: number,
  config: AgentConfig,
): RoadmapSprint[] {
  if (topDebts.length === 0) return [];

  const capacity = config.roadmap.sprintCapacityPoints;
  const points = config.roadmap.effortPoints;
  const findingById = new Map(findings.map((f) => [f.id, f]));

  const sprints: RoadmapSprint[] = [];
  const scheduledIds = new Set<string>();
  let current: RoadmapSprint | null = null;

  for (const debt of topDebts) {
    if (sprints.length >= MAX_SPRINTS) break;
    const cost = points[debt.effort];
    if (
      !current ||
      (current.effortPoints + cost > capacity && current.findingIds.length > 0)
    ) {
      current = {
        name: `Sprint ${sprints.length + 1}`,
        findingIds: [],
        itemCount: 0,
        effortPoints: 0,
        severity: { critical: 0, high: 0, medium: 0, low: 0 },
        projectedScoreAfter: 0,
      };
      sprints.push(current);
    }
    current.findingIds.push(debt.findingId);
    current.itemCount += 1;
    current.effortPoints += cost;
    scheduledIds.add(debt.findingId);
    const sev = findingById.get(debt.findingId)?.severity;
    if (sev) current.severity[sev] += 1;
  }

  // Cumulative projected score after each sprint is completed.
  const resolvedSoFar = new Set<string>();
  for (const sprint of sprints) {
    for (const id of sprint.findingIds) resolvedSoFar.add(id);
    const remaining = findings.filter((f) => !resolvedSoFar.has(f.id));
    sprint.projectedScoreAfter = computeScore(
      remaining,
      config,
      confidence,
    ).overall;
  }

  return sprints;
}
