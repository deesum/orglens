import { AnalyzerFinding, DependencyGraph } from "../types/models.js";

export function computeConfidence(findings: AnalyzerFinding[], graph: DependencyGraph): number {
  const findingCoverage = Math.min(1, findings.length / 100);
  const graphCoverage = graph.nodes.length > 0 ? Math.min(1, graph.edges.length / graph.nodes.length) : 0;
  const score = ((findingCoverage * 0.6) + (graphCoverage * 0.4)) * 100;
  return Math.round(score);
}
