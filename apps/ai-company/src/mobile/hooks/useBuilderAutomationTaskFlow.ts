import { useCallback, useEffect, useMemo, useState } from 'react'
import { TOOL_EXECUTION_RUN_SYNC_EVENT } from '../../domain/toolExecution/toolExecutionRunTypes'
import { EMPLOYEE_TOOL_REVIEW_SYNC_EVENT } from '../../domain/employeeToolReview/employeeToolReviewTypes'
import { DELEGATION_REVIEW_SYNC_EVENT } from '../../domain/delegationReview/delegationReviewTypes'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue/employeeWorkQueueStorage'
import { DELEGATION_PLAN_SYNC_EVENT } from '../../domain/delegationPlan/delegationPlanTypes'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import {
  acceptBuilderReviewForAutomationFlow,
  acceptMaxReviewForAutomationFlow,
  approveAndDispatchBuilderAutomation,
  buildBuilderAutomationFinalReport,
  createBuilderAutomationOwnerTask,
  loadBuilderAutomationTaskFlowSnapshot,
  rejectBuilderReviewForAutomationFlow,
  tickBuilderAutomationReconciliation,
  type BuilderAutomationFinalReport,
  type BuilderAutomationTaskFlowSnapshot,
  type CreateBuilderAutomationOwnerTaskInput,
} from '../../domain/builderAutomationTaskFlow'

export function useBuilderAutomationTaskFlow(runId: string | null) {
  const [tick, setTick] = useState(0)
  const [createForm, setCreateForm] = useState<CreateBuilderAutomationOwnerTaskInput>({
    title: 'Autonomous Builder Cursor task',
    instruction:
      'Create file tmp/autonomous-builder-test.txt with content: Hello from autonomous Builder',
    expectedResult: 'File tmp/autonomous-builder-test.txt exists with the greeting text.',
    repository: 'igor/servicemanager-ai-2.0',
    baseBranch: 'main',
    environment: 'dev',
    assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    fileScope: ['tmp/autonomous-builder-test.txt'],
    checks: [
      'npm --prefix apps/ai-company run test:domain',
      'npm --prefix apps/ai-company run build',
    ],
  })
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionInfo, setActionInfo] = useState<string | null>(null)
  const [createdRunId, setCreatedRunId] = useState<string | null>(runId)

  const refresh = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(TOOL_EXECUTION_RUN_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_TOOL_REVIEW_SYNC_EVENT, onChange)
    window.addEventListener(DELEGATION_REVIEW_SYNC_EVENT, onChange)
    window.addEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
    window.addEventListener(DELEGATION_PLAN_SYNC_EVENT, onChange)
    return () => {
      window.removeEventListener(TOOL_EXECUTION_RUN_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_TOOL_REVIEW_SYNC_EVENT, onChange)
      window.removeEventListener(DELEGATION_REVIEW_SYNC_EVENT, onChange)
      window.removeEventListener(EMPLOYEE_WORK_QUEUE_SYNC_EVENT, onChange)
      window.removeEventListener(DELEGATION_PLAN_SYNC_EVENT, onChange)
    }
  }, [refresh])

  const activeRunId = createdRunId ?? runId

  const snapshot: BuilderAutomationTaskFlowSnapshot | null = useMemo(() => {
    void tick
    if (!activeRunId) return null
    return loadBuilderAutomationTaskFlowSnapshot(activeRunId)
  }, [activeRunId, tick])

  const finalReport: BuilderAutomationFinalReport | null = useMemo(() => {
    if (!snapshot || !snapshot.showFinalReport) return null
    return buildBuilderAutomationFinalReport(snapshot)
  }, [snapshot])

  useEffect(() => {
    if (!activeRunId || !snapshot) return
    const pendingStates = new Set([
      'dispatching',
      'dispatched',
      'waiting_for_cursor_result',
      'result_discovered',
    ])
    if (!pendingStates.has(snapshot.uiState)) return

    let cancelled = false
    const interval = window.setInterval(() => {
      void tickBuilderAutomationReconciliation(activeRunId).then((outcome) => {
        if (!cancelled && outcome.ok) refresh()
      })
    }, 15_000)

    void tickBuilderAutomationReconciliation(activeRunId).then((outcome) => {
      if (!cancelled && outcome.ok) refresh()
    })

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeRunId, snapshot?.uiState, refresh])

  const createTask = useCallback(() => {
    setActionError(null)
    setActionInfo(null)
    const outcome = createBuilderAutomationOwnerTask(createForm)
    if (!outcome.ok) {
      setActionError(outcome.message)
      return null
    }
    setCreatedRunId(outcome.run.id)
    setActionInfo('Autonomous Builder task created — awaiting Owner approval.')
    refresh()
    return outcome.run.id
  }, [createForm, refresh])

  const approveAndDispatch = useCallback(async () => {
    if (!activeRunId) return
    setActionError(null)
    setActionInfo(null)
    const outcome = await approveAndDispatchBuilderAutomation(activeRunId)
    if (!outcome.ok) {
      setActionError(outcome.message)
      return
    }
    setActionInfo(`Dispatched — backgroundComposerId stored (${outcome.backgroundComposerId}).`)
    refresh()
  }, [activeRunId, refresh])

  const acceptBuilderReview = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = acceptBuilderReviewForAutomationFlow(activeRunId)
    if (!outcome.ok) {
      setActionError(outcome.message)
      return
    }
    setActionInfo('Builder review accepted — handed off to MAX.')
    refresh()
  }, [activeRunId, refresh])

  const rejectBuilderReview = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = rejectBuilderReviewForAutomationFlow(activeRunId, 'Owner rejected Builder review.')
    if (!outcome.ok) {
      setActionError(outcome.message)
      return
    }
    setActionInfo('Builder review rejected.')
    refresh()
  }, [activeRunId, refresh])

  const acceptMaxReview = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = acceptMaxReviewForAutomationFlow(activeRunId)
    if (!outcome.ok) {
      setActionError(outcome.message)
      return
    }
    setActionInfo('MAX review accepted — task completed.')
    refresh()
  }, [activeRunId, refresh])

  return {
    createForm,
    setCreateForm,
    snapshot,
    finalReport,
    actionError,
    actionInfo,
    createTask,
    approveAndDispatch,
    acceptBuilderReview,
    rejectBuilderReview,
    acceptMaxReview,
  }
}
