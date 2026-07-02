/** Screen ids covered by the global UX guidance system. */
export type UxGuidancePageId =
  | 'commandCenter'
  | 'runTask'
  | 'runtime'
  | 'runtimeLive'
  | 'operatingDay'
  | 'employeeProfile'
  | 'taskResults'
  | 'controlRoom'
  | 'kickoff'
  | 'visualLab'
  | 'workspace'

/** @deprecated Use UxGuidancePageId */
export type GuidedPageId = UxGuidancePageId

export type { PlatformGlossaryTermId, UxGuidanceTermId, GuidedTermId } from './platformGlossary'
export {
  PLATFORM_GLOSSARY_TERM_IDS,
  resolveGlossaryTermId,
} from './platformGlossary'

import type { PlatformGlossaryTermId } from './platformGlossary'

export const UX_GUIDANCE_PAGE_IDS: UxGuidancePageId[] = [
  'commandCenter',
  'runTask',
  'runtime',
  'runtimeLive',
  'operatingDay',
  'employeeProfile',
  'taskResults',
  'controlRoom',
  'kickoff',
  'visualLab',
  'workspace',
]

export const PAGE_GUIDE_TERMS: Record<UxGuidancePageId, PlatformGlossaryTermId[]> = {
  commandCenter: ['runtime', 'workspace', 'approval', 'operatingDay', 'timeline'],
  runTask: ['runtime', 'promptBuilder', 'modelRouter', 'employee', 'execution'],
  runtime: ['runtime', 'runtimeProvider', 'modelRouter', 'promptBuilder', 'costMonitor'],
  runtimeLive: ['runtime', 'promptBuilder', 'execution', 'costMonitor'],
  operatingDay: ['operatingDay', 'runtime', 'workspace', 'approval', 'sprint'],
  employeeProfile: ['employee', 'workspace', 'memory', 'approval'],
  taskResults: ['taskResult', 'memory', 'approval', 'workScheduler', 'report'],
  controlRoom: ['controlRoom', 'handoff', 'approval', 'workspace', 'sprint'],
  kickoff: ['kickoff', 'handoff', 'approval', 'sprint'],
  visualLab: ['runtime', 'promptBuilder', 'canvas', 'execution'],
  workspace: ['workspace', 'employee', 'runtime', 'workScheduler'],
}
