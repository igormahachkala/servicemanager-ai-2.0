export type GuidedPageId =
  | 'commandCenter'
  | 'runTask'
  | 'runtimeLive'
  | 'taskResults'
  | 'workspace'
  | 'operatingDay'
  | 'kickoff'
  | 'controlRoom'

export type GuidedTermId =
  | 'runtime'
  | 'workspace'
  | 'handoff'
  | 'approval'
  | 'memoryEvolution'
  | 'prompt'
  | 'modelRouter'

export const PAGE_GUIDE_TERMS: Record<GuidedPageId, GuidedTermId[]> = {
  commandCenter: ['runtime', 'workspace', 'approval'],
  runTask: ['runtime', 'prompt', 'modelRouter'],
  runtimeLive: ['runtime', 'prompt'],
  taskResults: ['memoryEvolution', 'approval'],
  workspace: ['workspace', 'runtime', 'approval'],
  operatingDay: ['runtime', 'workspace', 'approval'],
  kickoff: ['handoff', 'approval'],
  controlRoom: ['handoff', 'approval', 'workspace'],
}
