import { DependencyGraph, MetadataNode } from "../types/models.js";

export function buildDependencyGraph(nodes: MetadataNode[]): DependencyGraph {
  const ids = new Set(nodes.map((n) => n.id));
  const edges: Array<{ from: string; to: string }> = [];

  for (const node of nodes) {
    for (const ref of node.references) {
      const target = nodes.find(
        (n) => n.name === ref || n.id.endsWith(`:${ref}`),
      );
      if (target && ids.has(node.id)) {
        edges.push({ from: node.id, to: target.id });
      }
    }
  }

  return { nodes, edges };
}
