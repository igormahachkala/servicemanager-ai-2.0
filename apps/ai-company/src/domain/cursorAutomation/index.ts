/** Cursor Automation domain — 097A + 097C workflow + 099A submit + 099B adapter. */

export {
  CURSOR_AUTOMATION_RUN_STATUSES,
  CURSOR_AUTOMATION_TOOL_ID,
  CURSOR_AUTOMATION_TRIGGER_KINDS,
  type CursorAutomationIngestInput,
  type CursorAutomationPlanInput,
  type CursorAutomationPrSummary,
  type CursorAutomationPromptContext,
  type CursorAutomationResult,
  type CursorAutomationRuleCandidate,
  type CursorAutomationRunStatus,
  type CursorAutomationTask,
  type CursorAutomationTrigger,
  type CursorAutomationTriggerKind,
} from './cursorAutomation'

export {
  buildCursorAutomationPrompt,
  createCursorAutomationPlan,
  ingestCursorAutomationResult,
} from './cursorAutomationAdapter'

export {
  CURSOR_AUTOMATION_SYNC_EVENT,
  getCursorAutomationRunById,
  getCursorAutomationRunByRuntimeRunId,
  loadCursorAutomationRuns,
  saveCursorAutomationRuns,
  upsertCursorAutomationRun,
} from './cursorAutomationStorage'

export type {
  CursorAutomationExpectedResult,
  CursorAutomationHandoff,
  CursorAutomationMockIngestion,
  CursorAutomationPlan,
  CursorAutomationWorkflowLogEntry,
  CursorAutomationWorkflowPhase,
  CursorAutomationWorkflowSnapshot,
  CursorAutomationWorkflowStatus,
} from './cursorAutomationTypes'
export {
  CURSOR_AUTOMATION_TOOL_REGISTRY_ID,
  CURSOR_AUTOMATION_WORKFLOW_PHASES,
  CURSOR_AUTOMATION_WORKFLOW_VERSION,
} from './cursorAutomationTypes'
export { CURSOR_AUTOMATION_RULE_REFS, formatCursorRulesForPrompt } from './cursorAutomationRules'
export type { CursorRuleRef } from './cursorAutomationRules'
export {
  buildCursorAutomationPlan,
  detectExternalExecutorNeed,
} from './cursorAutomationPlan'
export {
  buildCursorAutomationHandoff,
  buildCursorAutomationPromptMarkdown,
} from './cursorAutomationHandoff'
export {
  buildCursorAutomationExpectedResult,
  ingestCursorAutomationMockResult,
} from './cursorAutomationMockIngestion'
export { buildCursorAutomationWorkflowSnapshot } from './cursorAutomationWorkflow'
export {
  buildCursorResultHistoryEvents,
  buildCursorResultIntegrationBundle,
  buildCursorResultIntegrationIfReady,
  buildCursorResultKnowledgeCandidates,
  buildCursorResultMaxReview,
  buildCursorResultMemoryHints,
  buildCursorResultRuntimeReportPatch,
  type CursorResultHistoryEventDraft,
  type CursorResultIntegrationBundle,
  type CursorResultIntegrationInput,
  type CursorResultIntegrationSource,
  type CursorResultKnowledgeCandidate,
  type CursorResultMaxReview,
  type CursorResultMemoryHint,
  type CursorResultRuntimeReportPatch,
} from './cursorAutomationResultIntegration'
export {
  approveCursorAutomationOwnerGate,
  CURSOR_AUTOMATION_OWNER_APPROVAL_SYNC_EVENT,
  CURSOR_AUTOMATION_OWNER_APPROVAL_STATUSES,
  getCursorAutomationOwnerApprovalByLoopId,
  getOrCreateCursorAutomationOwnerApproval,
  loadCursorAutomationOwnerApprovals,
  rejectCursorAutomationOwnerGate,
  type CursorAutomationOwnerApprovalRecord,
  type CursorAutomationOwnerApprovalStatus,
} from './cursorAutomationOwnerApproval'
export {
  evaluateCursorAutomationSubmitEligibility,
  isCursorAutomationApiAdapterAvailable,
  mapSubmitRunToWorkflowStatus,
  submitToCursorAutomation,
  type CursorAutomationSubmitEligibility,
  type CursorAutomationSubmitResult,
} from './cursorAutomationSubmit'
export type {
  CursorAutomationHandoffPayload,
  CursorAutomationSubmitDeliveryMode,
  CursorAutomationSubmitRun,
  CursorAutomationSubmitRunStatus,
} from './cursorAutomationSubmitRun'
export {
  CURSOR_AUTOMATION_SUBMIT_DELIVERY_MODES,
  CURSOR_AUTOMATION_SUBMIT_RUN_STATUSES,
} from './cursorAutomationSubmitRun'
export {
  CURSOR_AUTOMATION_SUBMIT_SYNC_EVENT,
  getCursorAutomationSubmitRunById,
  getCursorAutomationSubmitRunByLoopId,
  loadCursorAutomationSubmitRuns,
  upsertCursorAutomationSubmitRun,
} from './cursorAutomationSubmitStorage'
export type {
  CursorAutomationAdapterRunRecord,
  CursorAutomationAdapterRunStatus,
  CursorAutomationAdapterSubmitResult,
  CursorAutomationCancelResult,
  CursorAutomationIngestAdapterInput,
  CursorAutomationIngestAdapterResult,
  CursorAutomationRawPrPayload,
  CursorAutomationRawResultPayload,
  CursorAutomationRuntimeReportPatch,
  CursorAutomationServiceAdapter,
  CursorAutomationServiceAdapterKind,
  CursorAutomationStatusResult,
  CursorAutomationSubmitInput,
} from './cursorAutomationServiceAdapterTypes'
export {
  canCancelAdapterRun,
  canSubmitAdapterRun,
  CURSOR_AUTOMATION_ADAPTER_CONTRACT_VERSION,
  CURSOR_AUTOMATION_ADAPTER_KINDS,
  CURSOR_AUTOMATION_ADAPTER_RUN_STATUSES,
  isTerminalAdapterRunStatus,
  mapAdapterStatusToPersistenceHint,
} from './cursorAutomationServiceAdapterTypes'
export {
  buildNormalizedAutomationResult,
  extractPrFromRawPayload,
  mapPrToRuntimeReportPatch,
  mapResultToCursorRulesCandidates,
  mapResultToMemoryEvolutionHints,
  normalizeRawPrPayload,
} from './cursorAutomationServiceAdapterMappers'
export {
  createCursorAutomationServiceAdapterMock,
  CURSOR_AUTOMATION_ADAPTER_MOCK_SYNC_EVENT,
  getCursorAutomationAdapterRunById,
  getCursorAutomationServiceAdapterMock,
  listCursorAutomationAdapterRuns,
  markCursorAutomationAdapterRunReady,
  resetCursorAutomationServiceAdapterMockForTests,
} from './cursorAutomationServiceAdapterMock'
