/** Canonical platform terminology ids (AI-COMPANY-089). */
export const PLATFORM_GLOSSARY_TERM_IDS = [
  'runtime',
  'workspace',
  'sprint',
  'controlRoom',
  'kickoff',
  'approval',
  'taskResult',
  'memory',
  'knowledge',
  'canvas',
  'employee',
  'runtimeProvider',
  'modelRouter',
  'promptBuilder',
  'operatingDay',
  'handoff',
  'execution',
  'report',
  'timeline',
  'workScheduler',
  'costMonitor',
] as const

export type PlatformGlossaryTermId = (typeof PLATFORM_GLOSSARY_TERM_IDS)[number]

export type UxGuidanceTermId = PlatformGlossaryTermId

/** @deprecated Use PlatformGlossaryTermId */
export type GuidedTermId = PlatformGlossaryTermId

const LEGACY_TERM_ALIASES: Record<string, PlatformGlossaryTermId> = {
  memoryEvolution: 'memory',
  prompt: 'promptBuilder',
}

export function resolveGlossaryTermId(term: string): PlatformGlossaryTermId | null {
  const alias = LEGACY_TERM_ALIASES[term]
  if (alias) return alias
  if ((PLATFORM_GLOSSARY_TERM_IDS as readonly string[]).includes(term)) {
    return term as PlatformGlossaryTermId
  }
  return null
}

export type GlossaryTermMessages = {
  label: string
  summary: string
  tooltip: string
  description: string
  whereUsed: string
  related: Array<{ label: string; path: string }>
}
