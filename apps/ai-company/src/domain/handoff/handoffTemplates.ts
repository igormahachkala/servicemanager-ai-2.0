import type { HandoffPriority, HandoffChecklistItem } from './handoff'
import type { HandoffTarget } from './handoffTarget'

export type HandoffTemplate = {
  id: string
  name: string
  description: string
  target: HandoffTarget
  priority: HandoffPriority
  title: string
  descriptionTemplate: string
  instructions: string
  expectedResult: string
  constraints: string[]
  checklist: Omit<HandoffChecklistItem, 'done'>[]
  packageDefaults: {
    currentState: string
    files: string[]
    commands: string[]
    acceptanceCriteria: string[]
    expectedResponseFormat: string
  }
}

export const HANDOFF_TEMPLATES: HandoffTemplate[] = [
  {
    id: 'tpl-codex-code-task',
    name: 'Codex code task',
    description: 'Structured engineering handoff for Codex or Claude Code.',
    target: 'codex',
    priority: 'high',
    title: 'Implement scoped code change',
    descriptionTemplate: 'Digital employee prepared a code task for external implementation.',
    instructions:
      'Review project context, apply the requested change locally, run checks, and return a concise summary with touched files.',
    expectedResult: 'Working code change with passing local checks and a short implementation note.',
    constraints: [
      'Do not deploy to production.',
      'Stay within listed paths only.',
      'No new npm dependencies unless explicitly approved.',
    ],
    checklist: [
      { id: 'chk-context', label: 'Project and task context attached' },
      { id: 'chk-paths', label: 'Target files/paths listed' },
      { id: 'chk-acceptance', label: 'Acceptance criteria defined' },
      { id: 'chk-response', label: 'Expected response format documented' },
    ],
    packageDefaults: {
      currentState: 'Change requested by AI Company digital employee; implementation pending external executor.',
      files: [],
      commands: ['npm run build'],
      acceptanceCriteria: ['Build passes locally', 'Scope limited to listed files', 'Summary of changes included'],
      expectedResponseFormat:
        'Markdown summary + list of changed files + commands run + blockers if any.',
    },
  },
  {
    id: 'tpl-qa-review',
    name: 'QA review',
    description: 'Demo/readiness checklist for QA or human reviewer.',
    target: 'qa',
    priority: 'normal',
    title: 'Prepare QA review checklist',
    descriptionTemplate: 'QA handoff for demo or release readiness validation.',
    instructions:
      'Walk through the listed flows, capture pass/fail evidence, and return a structured checklist result.',
    expectedResult: 'Completed checklist with evidence links or notes and explicit go/no-go recommendation.',
    constraints: ['Mock/staging environment only', 'No production data'],
    checklist: [
      { id: 'chk-flows', label: 'Critical user flows listed' },
      { id: 'chk-env', label: 'Environment constraints documented' },
      { id: 'chk-evidence', label: 'Evidence format defined' },
    ],
    packageDefaults: {
      currentState: 'Feature ready for QA validation; automated coverage may be incomplete.',
      files: [],
      commands: [],
      acceptanceCriteria: ['All critical flows checked', 'Blockers listed explicitly', 'Go/no-go recommendation included'],
      expectedResponseFormat: 'Checklist table with status, notes, and final recommendation.',
    },
  },
  {
    id: 'tpl-devops-deployment',
    name: 'DevOps deployment',
    description: 'Deployment verification handoff for DevOps or platform operator.',
    target: 'devops',
    priority: 'high',
    title: 'Verify deployment procedure',
    descriptionTemplate: 'DevOps handoff to validate deployment steps and rollback path.',
    instructions:
      'Review deployment procedure, validate staging steps, and confirm rollback/readiness checks.',
    expectedResult: 'Verified procedure with commands, environment notes, and rollback confirmation.',
    constraints: ['No production deploy without Owner approval', 'Document every command before execution'],
    checklist: [
      { id: 'chk-procedure', label: 'Deployment procedure attached' },
      { id: 'chk-rollback', label: 'Rollback path documented' },
      { id: 'chk-env', label: 'Target environment identified' },
    ],
    packageDefaults: {
      currentState: 'Deployment procedure draft exists; external verification required before release.',
      files: ['scripts/stage-deploy-public.sh'],
      commands: ['npm run build'],
      acceptanceCriteria: ['Procedure reviewed', 'Rollback validated', 'Environment constraints confirmed'],
      expectedResponseFormat: 'Step-by-step verification log with commands, outcomes, and risks.',
    },
  },
  {
    id: 'tpl-design-handoff',
    name: 'Design handoff',
    description: 'UX/UI deliverable request for designer or Cursor-assisted design work.',
    target: 'designer',
    priority: 'normal',
    title: 'Design deliverable handoff',
    descriptionTemplate: 'Design handoff with constraints, references, and acceptance criteria.',
    instructions:
      'Review product context and return design artifacts or implementation-ready specs for the listed screens.',
    expectedResult: 'Design artifact or spec aligned with constraints and acceptance criteria.',
    constraints: ['Follow existing design system tokens', 'Desktop-first unless noted'],
    checklist: [
      { id: 'chk-references', label: 'Reference screens listed' },
      { id: 'chk-constraints', label: 'Design constraints attached' },
      { id: 'chk-deliverable', label: 'Deliverable format defined' },
    ],
    packageDefaults: {
      currentState: 'Product flow defined; visual design or polish pending.',
      files: [],
      commands: [],
      acceptanceCriteria: ['Matches design system', 'States and empty cases covered', 'Handoff notes included'],
      expectedResponseFormat: 'Figma link or markdown spec with screenshots and component mapping.',
    },
  },
  {
    id: 'tpl-documentation-task',
    name: 'Documentation task',
    description: 'Documentation update for human developer or Cursor.',
    target: 'cursor',
    priority: 'low',
    title: 'Update project documentation',
    descriptionTemplate: 'Documentation handoff for external writer or coding agent.',
    instructions:
      'Update the listed docs to reflect current behavior. Keep tone consistent with existing docs.',
    expectedResult: 'Updated documentation paths with summary of changes.',
    constraints: ['Docs only — no behavior changes', 'English primary, Russian where existing docs use it'],
    checklist: [
      { id: 'chk-scope', label: 'Doc scope listed' },
      { id: 'chk-audience', label: 'Audience and tone noted' },
      { id: 'chk-review', label: 'Review checklist attached' },
    ],
    packageDefaults: {
      currentState: 'Implementation exists; documentation lags behind current product behavior.',
      files: ['docs/'],
      commands: [],
      acceptanceCriteria: ['Docs match current behavior', 'Links valid', 'Change summary included'],
      expectedResponseFormat: 'List of updated files + short changelog + open questions.',
    },
  },
]

export function getHandoffTemplateById(id: string): HandoffTemplate | null {
  return HANDOFF_TEMPLATES.find((item) => item.id === id) ?? null
}

export function listHandoffTemplates(): HandoffTemplate[] {
  return HANDOFF_TEMPLATES
}
