/**
 * Employee Daily Journal — build entries from completed work (AI-COMPANY-103C).
 * Pure projection from real Runtime / Worker Loop artifacts — no fake data.
 */

import type { DecisionPlan } from '../decisionPlan'
import type { Report } from '../reports/report'
import type { RuntimeRun } from '../runtime/runtimeRun'
import { getToolRegistryV1EntryById } from '../toolRegistry'
import type { MaxWorkerLoopSnapshot } from '../maxWorkerLoop/maxWorkerLoopEngine'
import type { OwnerApprovalGate } from '../maxWorkerLoop/maxWorkerLoopApproval'
import type { MaxWorkerLoopPeerConsultationSnapshot } from '../maxWorkerLoop/maxWorkerLoopPeerConsultation'
import {
  createEmployeeDailyJournalEntryId,
  dateKeyFromIso,
  type EmployeeDailyJournalConsultation,
  type EmployeeDailyJournalDecision,
  type EmployeeDailyJournalEntry,
  type EmployeeDailyJournalModelUsage,
  type EmployeeDailyJournalReportLink,
  type EmployeeDailyJournalToolUsage,
} from './employeeDailyJournal'

function reportHref(reportId: string): string {
  return `/ops/reports/${encodeURIComponent(reportId)}`
}

function buildReportLinks(report: Report): EmployeeDailyJournalReportLink[] {
  return [
    {
      reportId: report.id,
      title: report.title,
      href: reportHref(report.id),
      summary: report.summary?.trim() || null,
    },
  ]
}

function buildToolsFromDecisionPlan(plan: DecisionPlan | null): EmployeeDailyJournalToolUsage[] {
  if (!plan) return []

  const items: EmployeeDailyJournalToolUsage[] = []
  const seen = new Set<string>()

  for (const toolId of plan.suggestedToolIds) {
    if (seen.has(toolId)) continue
    seen.add(toolId)
    const entry = getToolRegistryV1EntryById(toolId)
    items.push({
      toolId,
      label: entry?.name ?? toolId,
      reason: plan.toolRegistryReason,
    })
  }

  if (plan.cursorAutomationRequired) {
    const toolId = 'cursor-automation'
    if (!seen.has(toolId)) {
      items.push({
        toolId,
        label: 'Cursor Automation',
        reason: plan.cursorAutomationReason,
      })
    }
  }

  return items
}

function buildModelsFromDecisionPlanAndRun(
  plan: DecisionPlan | null,
  run: RuntimeRun,
  reasoningTag: string | null,
): EmployeeDailyJournalModelUsage[] {
  const items: EmployeeDailyJournalModelUsage[] = []
  const seen = new Set<string>()

  if (plan) {
    for (const model of plan.modelPipeline) {
      const key = model.catalogModelId
      if (seen.has(key)) continue
      seen.add(key)
      items.push({
        modelId: model.catalogModelId,
        label: model.label,
        role: model.role,
        ollamaTag: model.ollamaTag,
        reason: model.reason,
      })
    }
  }

  const reasoningModelId = run.modelId
  if (reasoningModelId && !seen.has(reasoningModelId)) {
    items.push({
      modelId: reasoningModelId,
      label: run.modelId,
      role: 'reasoning',
      ollamaTag: reasoningTag,
      reason: 'Runtime inference (Local Ollama)',
    })
  }

  return items
}

function buildConsultations(
  plan: DecisionPlan | null,
  peer: MaxWorkerLoopPeerConsultationSnapshot | null,
): EmployeeDailyJournalConsultation[] {
  const items: EmployeeDailyJournalConsultation[] = []

  if (peer?.required && peer.peerEmployeeId) {
    items.push({
      peerEmployeeId: peer.peerEmployeeId,
      peerDisplayName: peer.peerDisplayName,
      reason: peer.consultReason ?? plan?.peerConsultation.reason ?? null,
      outcome:
        peer.status === 'completed'
          ? peer.decisionSummary ?? peer.consumedSummary ?? peer.answerBody
          : peer.skipReason,
    })
    return items
  }

  if (plan?.peerConsultation.required && plan.peerConsultation.peerEmployeeId) {
    items.push({
      peerEmployeeId: plan.peerConsultation.peerEmployeeId,
      peerDisplayName: plan.peerConsultation.peerDisplayName,
      reason: plan.peerConsultation.reason,
      outcome: plan.peerConsultation.skipReason,
    })
  }

  return items
}

function buildDecisions(
  plan: DecisionPlan | null,
  ownerApproval: OwnerApprovalGate | null,
  peer: MaxWorkerLoopPeerConsultationSnapshot | null,
): EmployeeDailyJournalDecision[] {
  const items: EmployeeDailyJournalDecision[] = []

  if (plan) {
    for (const line of plan.rationale.slice(0, 8)) {
      items.push({
        summary: line,
        rationale: null,
        source: 'decision_plan',
      })
    }

    if (plan.ownerApprovalRequired && plan.ownerApprovalReasons.length > 0) {
      for (const reason of plan.ownerApprovalReasons) {
        items.push({
          summary: reason,
          rationale: 'Decision Plan: Owner Approval',
          source: 'decision_plan',
        })
      }
    }
  }

  if (peer?.status === 'completed' && peer.decisionSummary) {
    items.push({
      summary: peer.decisionSummary,
      rationale: peer.answerBody,
      source: 'peer_consult',
    })
  }

  if (ownerApproval?.required) {
    items.push({
      summary: `Owner Approval: ${ownerApproval.status}`,
      rationale: ownerApproval.reason,
      source: 'owner_approval',
    })
  }

  return items
}

function buildWorkSummary(snapshot: MaxWorkerLoopSnapshot): string {
  const parts: string[] = []
  const analysis = snapshot.reasoning.analysis?.trim()
  if (analysis) parts.push(analysis)

  if (snapshot.reasoning.plan.length > 0) {
    parts.push(`План: ${snapshot.reasoning.plan.slice(0, 5).join(' → ')}`)
  }

  const donePhases = snapshot.loop.phases
    .filter((item) => item.status === 'done' && item.detail?.trim())
    .slice(0, 6)
    .map((item) => item.detail!.trim())
  if (donePhases.length > 0) {
    parts.push(donePhases.join(' · '))
  }

  return parts.join('\n\n').trim() || snapshot.loop.input.taskText.trim()
}

function buildResultSummary(snapshot: MaxWorkerLoopSnapshot, report: Report): string {
  const parts: string[] = []
  const summary = snapshot.report.summary?.trim() || report.summary?.trim()
  if (summary) parts.push(summary)

  if (snapshot.report.findings.length > 0) {
    parts.push(`Findings: ${snapshot.report.findings.slice(0, 3).join(' · ')}`)
  }

  if (snapshot.report.nextStep) {
    parts.push(`Next: ${snapshot.report.nextStep}`)
  }

  return parts.join('\n\n').trim() || 'Задача завершена — см. Runtime Report.'
}

export function buildEmployeeDailyJournalEntryFromMaxWorkerLoopSnapshot(
  snapshot: MaxWorkerLoopSnapshot,
  run: RuntimeRun,
  report: Report,
  now: Date = new Date(),
): EmployeeDailyJournalEntry {
  const loop = snapshot.loop
  const plan = snapshot.decisionPlan ?? loop.decisionPlan
  const finishedAt = loop.finishedAt ?? run.finishedAt ?? now.toISOString()
  const startedAt = loop.createdAt ?? run.startedAt

  return {
    id: createEmployeeDailyJournalEntryId(now),
    version: 'v1',
    employeeId: loop.employeeId,
    dateKey: dateKeyFromIso(finishedAt),
    startedAt,
    finishedAt,
    taskTitle: loop.input.title?.trim() || plan?.taskTitle?.trim() || null,
    taskText: loop.input.taskText.trim(),
    workSummary: buildWorkSummary(snapshot),
    resultSummary: buildResultSummary(snapshot, report),
    toolsUsed: buildToolsFromDecisionPlan(plan),
    modelsUsed: buildModelsFromDecisionPlanAndRun(
      plan,
      run,
      snapshot.reasoning.ollamaModelTag,
    ),
    consultations: buildConsultations(plan, snapshot.peerConsultation ?? loop.peerConsultation ?? null),
    decisions: buildDecisions(plan, snapshot.ownerApproval, snapshot.peerConsultation ?? loop.peerConsultation ?? null),
    reportLinks: buildReportLinks(report),
    maxWorkerLoopId: loop.id,
    runtimeRunId: run.id,
    taskId: loop.deliveryTaskId ?? plan?.taskId ?? run.taskId,
    projectId: loop.input.projectId || null,
    workspaceId: loop.input.workspaceId || null,
    recordedAt: now.toISOString(),
  }
}

export type BuildEmployeeDailyJournalFromRuntimeInput = {
  employeeId: string
  run: RuntimeRun
  report: Report
  taskTitle?: string | null
  taskText?: string | null
  projectId?: string | null
  workspaceId?: string | null
  workSummary?: string | null
}

export function buildEmployeeDailyJournalEntryFromRuntimeCompletion(
  input: BuildEmployeeDailyJournalFromRuntimeInput,
  now: Date = new Date(),
): EmployeeDailyJournalEntry {
  const finishedAt = input.run.finishedAt ?? now.toISOString()
  const startedAt = input.run.startedAt
  const taskText =
    input.taskText?.trim() ||
    input.run.promptPreview?.task?.trim() ||
    input.run.context.layers.find((layer) => layer.key === 'current_task')?.summary?.trim() ||
    input.report.summary?.trim() ||
    'Runtime task'

  const workSummary =
    input.workSummary?.trim() ||
    input.report.summary?.trim() ||
    input.run.result?.responseText?.trim()?.slice(0, 480) ||
    taskText

  const resultParts: string[] = []
  if (input.report.summary?.trim()) resultParts.push(input.report.summary.trim())
  if (input.report.findings.length > 0) {
    resultParts.push(input.report.findings.slice(0, 3).join(' · '))
  }

  const modelsUsed: EmployeeDailyJournalModelUsage[] = [
    {
      modelId: input.run.modelId,
      label: input.run.modelId,
      role: 'reasoning',
      ollamaTag: null,
      reason: `Provider: ${input.run.providerId}`,
    },
  ]

  return {
    id: createEmployeeDailyJournalEntryId(now),
    version: 'v1',
    employeeId: input.employeeId,
    dateKey: dateKeyFromIso(finishedAt),
    startedAt,
    finishedAt,
    taskTitle: input.taskTitle?.trim() || null,
    taskText,
    workSummary,
    resultSummary: resultParts.join('\n\n').trim() || 'Runtime run completed.',
    toolsUsed: [],
    modelsUsed,
    consultations: [],
    decisions: input.report.recommendations.slice(0, 5).map((line) => ({
      summary: line,
      rationale: null,
      source: 'runtime' as const,
    })),
    reportLinks: buildReportLinks(input.report),
    maxWorkerLoopId: null,
    runtimeRunId: input.run.id,
    taskId: input.run.taskId,
    projectId: input.projectId ?? null,
    workspaceId: input.workspaceId ?? input.run.workspaceId,
    recordedAt: now.toISOString(),
  }
}
