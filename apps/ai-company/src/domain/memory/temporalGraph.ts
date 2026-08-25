/**
 * Temporal relationship graph — bi-temporal memory for relationship-heavy roles.
 *
 * Complements fact-level memory (importance/retention/reconciliation) with a graph of
 * typed relationships between entities, where every edge carries valid-time. Updates
 * are NON-DESTRUCTIVE: a new single-valued relationship invalidates the prior one
 * (sets its validTo) instead of deleting it, so history is queryable "as of" any time.
 * Zep/Graphiti pattern. Pure, dependency-free, deterministic (caller supplies ids/timestamps).
 */

export type GraphEntity = { id: string; type: string; label: string }

export type GraphEdge = {
  id: string
  from: string
  to: string
  /** relationship type, e.g. 'prefers', 'contact_of', 'assigned_to' */
  type: string
  /** ISO timestamp the relationship became true */
  validFrom: string
  /** ISO timestamp it stopped being true; null = still valid */
  validTo: string | null
  /** ISO timestamp the system learned it (transaction-time) */
  recordedAt: string
}

export type TemporalGraph = {
  entities: Record<string, GraphEntity>
  edges: GraphEdge[]
}

export function createGraph(): TemporalGraph {
  return { entities: {}, edges: [] }
}

export function upsertEntity(graph: TemporalGraph, entity: GraphEntity): TemporalGraph {
  return { ...graph, entities: { ...graph.entities, [entity.id]: entity } }
}

export function isActiveAt(edge: GraphEdge, at: string): boolean {
  return edge.validFrom <= at && (edge.validTo === null || at < edge.validTo)
}

export function edgesAt(graph: TemporalGraph, at: string): GraphEdge[] {
  return graph.edges.filter((e) => isActiveAt(e, at))
}

export function currentEdges(graph: TemporalGraph): GraphEdge[] {
  return graph.edges.filter((e) => e.validTo === null)
}

export type AddEdgeOptions = {
  /**
   * When true, a single relationship of this (from,type) may be active at a time:
   * adding a new one invalidates prior active ones (validTo = new edge.validFrom).
   * e.g. "customer PREFERS delivery window" — a new preference supersedes the old.
   */
  singleValued?: boolean
}

export function addEdge(
  graph: TemporalGraph,
  edge: GraphEdge,
  options: AddEdgeOptions = {},
): TemporalGraph {
  let edges = graph.edges
  if (options.singleValued) {
    edges = edges.map((e) =>
      e.from === edge.from && e.type === edge.type && e.validTo === null && e.id !== edge.id
        ? { ...e, validTo: edge.validFrom }
        : e,
    )
  }
  return { ...graph, edges: [...edges, edge] }
}

/** Entities related to `entityId` via active edges at time `at` (optionally filtered by type). */
export function neighborsAt(
  graph: TemporalGraph,
  entityId: string,
  at: string,
  type?: string,
): GraphEntity[] {
  const ids = new Set<string>()
  for (const e of graph.edges) {
    if (!isActiveAt(e, at)) continue
    if (type && e.type !== type) continue
    if (e.from === entityId) ids.add(e.to)
    else if (e.to === entityId) ids.add(e.from)
  }
  return [...ids].map((id) => graph.entities[id]).filter((x): x is GraphEntity => Boolean(x))
}
