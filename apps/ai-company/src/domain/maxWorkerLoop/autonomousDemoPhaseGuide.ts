import type { MaxWorkerLoopSnapshot } from './maxWorkerLoopEngine'
import type { MaxWorkerLoopRecord } from './maxWorkerLoop'
import type { MaxWorkerLoopUiStepStatus, MaxWorkerLoopUiStepView } from './maxWorkerLoopViewModel'

export const AUTONOMOUS_DEMO_UI_STEP_IDS = [
  'task_intake',
  'analysis',
  'reasoning',
  'plan',
  'tool_decision',
  'cursor_plan',
  'owner_approval',
  'mock_submit',
  'mock_pr',
  'max_review',
  'runtime_report',
  'memory_draft',
  'knowledge_draft',
  'next_actions',
] as const

export type AutonomousDemoUiStepId = (typeof AUTONOMOUS_DEMO_UI_STEP_IDS)[number]

type StepDef = {
  id: AutonomousDemoUiStepId
  label: string
  whatHappens: string
  whatNext: string
}

export const AUTONOMOUS_DEMO_STEP_GUIDE_RU: Record<AutonomousDemoUiStepId, StepDef> = {
  task_intake: {
    id: 'task_intake',
    label: 'Owner → MAX',
    whatHappens: 'Owner формулирует demo-задачу; MAX фиксирует контекст проекта.',
    whatNext: 'Task Runner запускает real Runtime + Ollama.',
  },
  analysis: {
    id: 'analysis',
    label: 'Анализ',
    whatHappens: 'MAX извлекает scope из Runtime Report body.',
    whatNext: 'Reasoning через Local Ollama.',
  },
  reasoning: {
    id: 'reasoning',
    label: 'Ollama Reasoning',
    whatHappens: 'Real inference — ответ модели сохраняется в Runtime Run.',
    whatNext: 'Формируется plan и tool decision.',
  },
  plan: {
    id: 'plan',
    label: 'План',
    whatHappens: 'Recommendations и plan lines из отчёта.',
    whatNext: 'Проверка необходимости Cursor Automation.',
  },
  tool_decision: {
    id: 'tool_decision',
    label: 'Tool Decision',
    whatHappens: 'MAX определяет: нужен ли внешний исполнитель (Cursor Automation).',
    whatNext: 'Cursor Automation Plan или переход к Report.',
  },
  cursor_plan: {
    id: 'cursor_plan',
    label: 'Cursor Automation Plan',
    whatHappens: 'Формируется plan: scope, checks, .cursor/rules refs, mock PR outline.',
    whatNext: 'Owner Approval (mock в demo V1).',
  },
  owner_approval: {
    id: 'owner_approval',
    label: 'Owner Approval (mock)',
    whatHappens: 'Demo фиксирует точку gate — в V2 Owner одобряет в /ops/approvals.',
    whatNext: 'Mock submit handoff (без Cursor API).',
  },
  mock_submit: {
    id: 'mock_submit',
    label: 'Mock Submit',
    whatHappens: 'Handoff markdown «отправлен» локально — без сети.',
    whatNext: 'Mock PR ingestion.',
  },
  mock_pr: {
    id: 'mock_pr',
    label: 'Mock PR',
    whatHappens: 'Сгенерирован mock PR URL и summary изменений.',
    whatNext: 'MAX Review mock результата.',
  },
  max_review: {
    id: 'max_review',
    label: 'MAX Review',
    whatHappens: 'MAX принимает mock outcome для Runtime Report (display-only).',
    whatNext: 'Runtime Report + drafts.',
  },
  runtime_report: {
    id: 'runtime_report',
    label: 'Runtime Report',
    whatHappens: 'Real structured report из завершённого Run.',
    whatNext: 'Memory Evolution draft.',
  },
  memory_draft: {
    id: 'memory_draft',
    label: 'Memory Evolution',
    whatHappens: 'Lessons из Run — черновик без автопубликации.',
    whatNext: 'Knowledge Candidate drafts.',
  },
  knowledge_draft: {
    id: 'knowledge_draft',
    label: 'Knowledge Candidate',
    whatHappens: 'Best practices → candidates для Owner review.',
    whatNext: 'Next Actions.',
  },
  next_actions: {
    id: 'next_actions',
    label: 'Next Actions',
    whatHappens: 'Follow-up для Owner после demo цикла.',
    whatNext: 'Promote Knowledge → .cursor/rules (097B).',
  },
}

function stepStatus(
  loop: MaxWorkerLoopRecord,
  ready: boolean,
  skipped = false,
): MaxWorkerLoopUiStepStatus {
  if (skipped) return 'skipped'
  if (loop.status === 'failed') return ready ? 'done' : 'failed'
  if (loop.status === 'running' || loop.status === 'queued') return ready ? 'done' : 'pending'
  if (loop.status === 'completed') return ready ? 'done' : 'pending'
  return 'pending'
}

export function buildAutonomousDemoPanelSteps(
  loop: MaxWorkerLoopRecord,
  snapshot: MaxWorkerLoopSnapshot | null,
): MaxWorkerLoopUiStepView[] {
  const cursor = snapshot?.cursorAutomation ?? null
  const external = Boolean(cursor?.externalExecutorRequired)
  const completed = loop.status === 'completed'

  const reasoningReady = completed && Boolean(snapshot?.reasoning.analysis)
  const planReady = completed && (snapshot?.reasoning.plan.length ?? 0) > 0
  const cursorPlanReady = completed && external && Boolean(cursor?.plan)
  const mockReady = completed && external && Boolean(cursor?.mockIngestion)
  const reportReady = completed && Boolean(loop.reportId)

  return AUTONOMOUS_DEMO_UI_STEP_IDS.map((stepId) => {
    const guide = AUTONOMOUS_DEMO_STEP_GUIDE_RU[stepId]
    let status: MaxWorkerLoopUiStepStatus = 'pending'
    let insight: string | null = null

    switch (stepId) {
      case 'task_intake':
        status = stepStatus(loop, loop.phases.some((p) => p.phase === 'max_intake' && p.status === 'done'))
        break
      case 'analysis':
        status = stepStatus(loop, reasoningReady)
        insight = snapshot?.reasoning.analysis.slice(0, 200) ?? null
        break
      case 'reasoning':
        status = stepStatus(loop, reasoningReady)
        insight =
          snapshot?.reasoning.durationMs != null
            ? `Ollama · ${snapshot.reasoning.durationMs} ms`
            : null
        break
      case 'plan':
        status = stepStatus(loop, planReady)
        insight = snapshot?.reasoning.plan.slice(0, 2).join(' · ') ?? null
        break
      case 'tool_decision':
        status = stepStatus(loop, completed, !external)
        insight = cursor?.needReason ?? 'Внешний исполнитель не требуется'
        break
      case 'cursor_plan':
        status = stepStatus(loop, cursorPlanReady, !external)
        insight = cursor?.plan?.goal.slice(0, 160) ?? null
        break
      case 'owner_approval':
        status = stepStatus(loop, completed && external, !external)
        insight = external ? 'Demo: gate зафиксирован (mock)' : null
        break
      case 'mock_submit':
        status = stepStatus(loop, mockReady, !external)
        insight = cursor?.handoff?.handoffId ?? null
        break
      case 'mock_pr':
        status = stepStatus(loop, mockReady, !external)
        insight = cursor?.mockIngestion?.result.pullRequest.url ?? null
        break
      case 'max_review':
        status = stepStatus(loop, mockReady, !external)
        insight = cursor?.mockIngestion?.result.report.summary ?? null
        break
      case 'runtime_report':
        status = stepStatus(loop, reportReady)
        insight = loop.reportId
        break
      case 'memory_draft':
        status = stepStatus(loop, completed)
        insight = snapshot
          ? `${snapshot.memoryEvolutionDraft.lessons.length} уроков (draft)`
          : null
        break
      case 'knowledge_draft':
        status = stepStatus(loop, completed)
        insight = snapshot ? `${snapshot.knowledgeCandidates.length} candidates` : null
        break
      case 'next_actions':
        status = stepStatus(loop, completed)
        insight = snapshot?.nextActions.slice(0, 2).map((a) => a.label).join(' · ') ?? null
        break
    }

    if (loop.status === 'running' && status === 'pending' && stepId === 'reasoning') {
      status = 'active'
    }

    return {
      id: stepId,
      label: guide.label,
      status,
      completedAt: completed ? loop.finishedAt : null,
      description: null,
      whatHappens: guide.whatHappens,
      whatNext: guide.whatNext,
      insight,
    }
  })
}

export function pickAutonomousDemoCurrentStep(
  steps: MaxWorkerLoopUiStepView[],
  loop: MaxWorkerLoopRecord,
): AutonomousDemoUiStepId | null {
  if (loop.status === 'running' || loop.status === 'queued') {
    return steps.find((s) => s.status === 'active' || s.status === 'pending')?.id as AutonomousDemoUiStepId ?? 'reasoning'
  }
  if (loop.status === 'completed') return 'next_actions'
  return steps.find((s) => s.status === 'failed')?.id as AutonomousDemoUiStepId ?? null
}
