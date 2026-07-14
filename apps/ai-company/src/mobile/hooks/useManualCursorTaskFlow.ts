import { useCallback, useEffect, useMemo, useState } from 'react'
import { TOOL_EXECUTION_RUN_SYNC_EVENT } from '../../domain/toolExecution/toolExecutionRunTypes'
import { EMPLOYEE_TOOL_REVIEW_SYNC_EVENT } from '../../domain/employeeToolReview/employeeToolReviewTypes'
import { DELEGATION_REVIEW_SYNC_EVENT } from '../../domain/delegationReview/delegationReviewTypes'
import { EMPLOYEE_WORK_QUEUE_SYNC_EVENT } from '../../domain/employeeWorkQueue/employeeWorkQueueStorage'
import { DELEGATION_PLAN_SYNC_EVENT } from '../../domain/delegationPlan/delegationPlanTypes'
import { EMPLOYEE_ROUTE_IDS } from '../../mission-control/data/employeeIdResolver'
import {
  acceptBuilderReviewForManualCursorFlow,
  acceptMaxReviewForManualCursorFlow,
  approveManualCursorOwnerExecution,
  buildManualCursorFinalReport,
  createManualCursorOwnerTask,
  loadManualCursorTaskFlowSnapshot,
  rejectBuilderReviewForManualCursorFlow,
  submitManualCursorResultImport,
  type CreateManualCursorOwnerTaskInput,
  type ManualCursorFinalReport,
  type ManualCursorTaskFlowSnapshot,
} from '../../domain/manualCursorTaskFlow'
import type { ManualCloudAgentImportFinalStatus } from '../../domain/manualCloudAgentImport/manualCloudAgentImportTypes'

export type ManualCursorImportFormState = {
  branch: string
  commitSha: string
  pullRequestUrl: string
  summary: string
  changedFilesText: string
  checksText: string
  errorsText: string
  startedAt: string
  finishedAt: string
  finalStatus: ManualCloudAgentImportFinalStatus
}

const DEFAULT_IMPORT_FORM: ManualCursorImportFormState = {
  branch: '',
  commitSha: '',
  pullRequestUrl: '',
  summary: '',
  changedFilesText: 'tmp/first-real-ai-company-task.txt',
  checksText: 'build|PASSED|ok',
  errorsText: '',
  startedAt: '',
  finishedAt: new Date().toISOString(),
  finalStatus: 'SUCCEEDED',
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseChecks(text: string) {
  return parseLines(text).map((line) => {
    const [name, status, details] = line.split('|').map((part) => part.trim())
    const normalized =
      status === 'FAILED' || status === 'SKIPPED' || status === 'PASSED' ? status : 'PASSED'
    return { name: name || 'check', status: normalized as 'PASSED' | 'FAILED' | 'SKIPPED', details }
  })
}

function parseErrors(text: string) {
  return parseLines(text).map((line) => {
    const [code, ...rest] = line.split('|')
    return { code: code?.trim() || 'ERROR', message: rest.join('|').trim() || line }
  })
}

export function useManualCursorTaskFlow(runId: string | null) {
  const [tick, setTick] = useState(0)
  const [createForm, setCreateForm] = useState<CreateManualCursorOwnerTaskInput>({
    title: 'First real AI Company Cursor task',
    instruction:
      'Create file tmp/first-real-ai-company-task.txt with content: Hello from AI Company real task flow',
    expectedResult: 'File tmp/first-real-ai-company-task.txt exists with the greeting text.',
    repository: 'igor/servicemanager-ai-2.0',
    baseBranch: 'main',
    requiresRepositoryWrite: true,
    requiresCommitOrPullRequest: true,
    requiresReliableCompletion: true,
    environment: 'dev',
    assignedEmployeeId: EMPLOYEE_ROUTE_IDS.builder,
    fileScope: ['tmp/first-real-ai-company-task.txt'],
    checks: [
      'npm --prefix apps/ai-company run test:domain',
      'npm --prefix apps/ai-company run build',
    ],
  })
  const [importForm, setImportForm] = useState<ManualCursorImportFormState>(DEFAULT_IMPORT_FORM)
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

  const snapshot: ManualCursorTaskFlowSnapshot | null = useMemo(() => {
    void tick
    if (!activeRunId) return null
    return loadManualCursorTaskFlowSnapshot(activeRunId)
  }, [activeRunId, tick])

  const finalReport: ManualCursorFinalReport | null = useMemo(() => {
    if (!snapshot || !snapshot.showFinalReport) return null
    return buildManualCursorFinalReport(snapshot)
  }, [snapshot])

  const createTask = useCallback(() => {
    setActionError(null)
    setActionInfo(null)
    const outcome = createManualCursorOwnerTask(createForm)
    if (!outcome.ok) {
      setActionError(outcome.message)
      return null
    }
    setCreatedRunId(outcome.run.id)
    setActionInfo('Task created. Review route decision and approve manual execution.')
    refresh()
    return outcome.run.id
  }, [createForm, refresh])

  const approveExecution = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = approveManualCursorOwnerExecution(activeRunId)
    if (!outcome.ok) {
      setActionError(outcome.message)
      return
    }
    setActionInfo('Approved. Copy the Cursor task package and run Cloud Agent manually.')
    refresh()
  }, [activeRunId, refresh])

  const copyTaskPackage = useCallback(async () => {
    if (!snapshot?.taskPackage) return false
    try {
      await navigator.clipboard.writeText(snapshot.taskPackage)
      setActionInfo('Cursor task package copied.')
      return true
    } catch {
      setActionError('Could not copy task package to clipboard.')
      return false
    }
  }, [snapshot?.taskPackage])

  const importResult = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = submitManualCursorResultImport({
      toolExecutionRunId: activeRunId,
      branch: importForm.branch.trim() || null,
      commitSha: importForm.commitSha.trim() || null,
      pullRequestUrl: importForm.pullRequestUrl.trim() || null,
      summary: importForm.summary.trim(),
      changedFiles: parseLines(importForm.changedFilesText),
      checks: parseChecks(importForm.checksText),
      artifacts: importForm.pullRequestUrl.trim()
        ? [
            {
              type: 'pull_request',
              reference: importForm.pullRequestUrl.trim(),
            },
          ]
        : [],
      errors: parseErrors(importForm.errorsText),
      startedAt: importForm.startedAt.trim() || null,
      finishedAt: importForm.finishedAt.trim(),
      finalStatus: importForm.finalStatus,
    })

    if (!outcome.ok) {
      setActionError(`${outcome.reasonCode}: ${outcome.message}`)
      return
    }

    setActionInfo(`Import accepted (${outcome.importReasonCode}).`)
    refresh()
  }, [activeRunId, importForm, refresh])

  const acceptBuilderReview = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = acceptBuilderReviewForManualCursorFlow(activeRunId)
    if (!outcome.ok) {
      setActionError(`${outcome.code}: ${outcome.message}`)
      return
    }
    setActionInfo('Builder review accepted. MAX review is now available.')
    refresh()
  }, [activeRunId, refresh])

  const rejectBuilderReview = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = rejectBuilderReviewForManualCursorFlow(
      activeRunId,
      'Builder rejected manual Cursor result.',
    )
    if (!outcome.ok) {
      setActionError(`${outcome.code}: ${outcome.message}`)
      return
    }
    setActionInfo('Builder review rejected.')
    refresh()
  }, [activeRunId, refresh])

  const acceptMaxReview = useCallback(() => {
    if (!activeRunId) return
    setActionError(null)
    const outcome = acceptMaxReviewForManualCursorFlow(activeRunId)
    if (!outcome.ok) {
      setActionError(`${outcome.code}: ${outcome.message}`)
      return
    }
    setActionInfo('MAX review accepted. Task flow completed.')
    refresh()
  }, [activeRunId, refresh])

  return {
    createForm,
    setCreateForm,
    importForm,
    setImportForm,
    snapshot,
    finalReport,
    activeRunId,
    actionError,
    actionInfo,
    createTask,
    approveExecution,
    copyTaskPackage,
    importResult,
    acceptBuilderReview,
    rejectBuilderReview,
    acceptMaxReview,
    refresh,
  }
}
