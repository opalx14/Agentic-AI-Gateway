import type { DependencyGraph } from "./types";

export const logisticsDependencyGraph: DependencyGraph = {
  edges: {
    inbound_shipment: ["warehouse_inventory"],
    warehouse_inventory: ["fulfillment"],
    fulfillment: ["customer_sla"],
    customer_sla: [],
  },
};

export function collectAffectedNodes(
  graph: DependencyGraph,
  startNode: string,
): string[] {
  const visited = new Set<string>();
  const queue = [...(graph.edges[startNode] ?? [])];

  while (queue.length > 0) {
    const node = queue.shift();

    if (!node || visited.has(node)) {
      continue;
    }

    visited.add(node);
    queue.push(...(graph.edges[node] ?? []));
  }

  return [...visited];
}
