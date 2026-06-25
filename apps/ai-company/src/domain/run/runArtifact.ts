export const RUN_ARTIFACT_KINDS = [
  'generated_report',
  'generated_summary',
  'generated_adr',
  'generated_task',
  'generated_document',
] as const

export type RunArtifactKind = (typeof RUN_ARTIFACT_KINDS)[number]

/** Placeholder artifacts — no real generation in V1. */
export type RunArtifact = {
  id: string
  kind: RunArtifactKind
  label: string
  refId: string | null
  placeholder: boolean
}
