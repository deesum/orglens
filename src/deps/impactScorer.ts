import { DependencyGraph } from "../types/models.js";

export function computeBlastRadius(graph: DependencyGraph): Map<string, number> {
  const incomingCount = new Map<string, number>();
  for (const node of graph.nodes) {
    incomingCount.set(node.id, 0);
  }
  for (const edge of graph.edges) {
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1);
  }

  const maxIncoming = Math.max(1, ...incomingCount.values());
  for (const [id, count] of incomingCount.entries()) {
    incomingCount.set(id, Math.round((count / maxIncoming) * 100));
  }
  return incomingCount;
}
