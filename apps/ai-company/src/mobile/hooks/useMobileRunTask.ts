import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createEmployeeWorkItem,
  getEmployeeWorkItemById,
  type WorkItem,
  type WorkPriority,
} from '../../domain/employeeWorkQueue'
import { startEmployeeOperatingDay } from '../../domain/employeeOperatingDay'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import {
  DEFAULT_COMPLEX_TASK_FORM,
  MOBILE_COMPLEX_TASK_TEMPLATES,
  buildStructuredPayloadFromComplexForm,
  buildStructuredPayloadFromQuickForm,
  buildTaskTextFromComplexForm,
  findMobileComplexTaskTemplate,
  isMobileComplexTaskFormValid,
  isMobileComplexTaskTemplateId,
  type MobileComplexTaskFormState,
  type MobileComplexTaskTemplateId,
  type MobileTaskMode,
} from '../tasks/mobileComplexTaskPayload'
import {
  deriveTaskTitle,
  findMobileTaskTemplate,
  isEnabledMobileRunTaskEmployee,
  isMobileRunTaskFormValid,
  isMobileTaskTemplateId,
  MOBILE_RUN_TASK_EMPLOYEES,
  type MobileTaskTemplateId,
} from '../runTask/mobileRunTaskConfig'

export type MobileRunTaskFormState = {
  employeeId: string
  title: string
  taskText: string
  priority: WorkPriority
  expectedOutput: string
  templateId: MobileTaskTemplateId | null
}

const DEFAULT_FORM: MobileRunTaskFormState = {
  employeeId: MAX_WORKER_EMPLOYEE_ID,
  title: '',
  taskText: '',
  priority: 'medium',
  expectedOutput: '',
  templateId: null,
}

function resolveInitialEmployee(raw: string | null): string {
  if (!raw) return MAX_WORKER_EMPLOYEE_ID
  const canonical = resolveCanonicalEmployeeId(raw)
  return isEnabledMobileRunTaskEmployee(canonical) ? canonical : MAX_WORKER_EMPLOYEE_ID
}

function resolveInitialMode(raw: string | null): MobileTaskMode {
  return raw === 'complex' ? 'complex' : 'quick'
}

export type MobileRunTaskValidationMessages = {
  emptyTaskText: string
  emptyTitle: string
  emptyObjective: string
  emptyComplexTitle: string
  persistFailed: string
}

export function useMobileRunTask() {
  const [searchParams] = useSearchParams()
  const [taskMode, setTaskMode] = useState<MobileTaskMode>(() =>
    resolveInitialMode(searchParams.get('mode')),
  )
  const [form, setForm] = useState<MobileRunTaskFormState>(() => ({
    ...DEFAULT_FORM,
    employeeId: resolveInitialEmployee(searchParams.get('employee')),
  }))
  const [complexForm, setComplexForm] = useState<MobileComplexTaskFormState>(DEFAULT_COMPLEX_TASK_FORM)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdItem, setCreatedItem] = useState<WorkItem | null>(null)

  const templateParam = searchParams.get('template')
  const modeParam = searchParams.get('mode')

  const patchForm = useCallback((patch: Partial<MobileRunTaskFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
    setValidationError(null)
    setSubmitError(null)
  }, [])

  const patchComplexForm = useCallback((patch: Partial<MobileComplexTaskFormState>) => {
    setComplexForm((current) => ({ ...current, ...patch }))
    setValidationError(null)
    setSubmitError(null)
  }, [])

  const selectEmployee = useCallback(
    (employeeId: string) => {
      const canonical = resolveCanonicalEmployeeId(employeeId)
      if (!isEnabledMobileRunTaskEmployee(canonical)) return
      patchForm({ employeeId: canonical })
    },
    [patchForm],
  )

  const applyTemplate = useCallback(
    (templateId: MobileTaskTemplateId) => {
      const template = findMobileTaskTemplate(templateId)
      if (!template) return
      patchForm({
        templateId,
        title: template.title,
        taskText: template.taskText,
        expectedOutput: template.expectedOutput,
        priority: template.priority,
      })
    },
    [patchForm],
  )

  const applyComplexTemplate = useCallback(
    (templateId: MobileComplexTaskTemplateId) => {
      const template = findMobileComplexTaskTemplate(templateId)
      if (!template) return
      patchComplexForm({
        templateId,
        title: template.title,
        objective: template.objective,
        context: template.context,
        expectedResult: template.expectedResult,
        constraints: template.constraints,
        forbidden: template.forbidden,
        deadline: template.deadline,
        priority: template.priority,
        needsReport: template.needsReport,
        needsNextSteps: template.needsNextSteps,
      })
    },
    [patchComplexForm],
  )

  useEffect(() => {
    if (modeParam === 'complex' || modeParam === 'quick') {
      setTaskMode(modeParam)
    }
  }, [modeParam])

  useEffect(() => {
    if (!templateParam) return
    if (taskMode === 'complex' && isMobileComplexTaskTemplateId(templateParam)) {
      applyComplexTemplate(templateParam)
      return
    }
    if (taskMode === 'quick' && isMobileTaskTemplateId(templateParam)) {
      applyTemplate(templateParam)
    }
  }, [applyComplexTemplate, applyTemplate, taskMode, templateParam])

  const resetForm = useCallback(() => {
    setForm({
      ...DEFAULT_FORM,
      employeeId: form.employeeId,
    })
    setComplexForm(DEFAULT_COMPLEX_TASK_FORM)
    setValidationError(null)
    setSubmitError(null)
    setCreatedItem(null)
  }, [form.employeeId])

  const changeTaskMode = useCallback((mode: MobileTaskMode) => {
    setTaskMode(mode)
    setValidationError(null)
    setSubmitError(null)
  }, [])

  const isFormValid = useMemo(() => {
    if (taskMode === 'complex') {
      return isMobileComplexTaskFormValid(complexForm)
    }
    return isMobileRunTaskFormValid(form.title, form.taskText)
  }, [complexForm, form.title, form.taskText, taskMode])

  const submit = useCallback(
    (messages: MobileRunTaskValidationMessages) => {
      setSubmitError(null)
      const employeeId = resolveCanonicalEmployeeId(form.employeeId)

      if (taskMode === 'complex') {
        const title = complexForm.title.trim()
        const objective = complexForm.objective.trim()

        if (!title) {
          setValidationError(messages.emptyComplexTitle)
          return null
        }
        if (!objective) {
          setValidationError(messages.emptyObjective)
          return null
        }

        const taskText = buildTaskTextFromComplexForm(complexForm)
        const structuredPayload = buildStructuredPayloadFromComplexForm(complexForm)
        const summary = complexForm.expectedResult.trim() || null

        const item = createEmployeeWorkItem({
          employeeId,
          title,
          taskText,
          summary,
          priority: complexForm.priority,
          structuredPayload,
        })

        const persisted = getEmployeeWorkItemById(item.id)
        if (!persisted) {
          setSubmitError(messages.persistFailed)
          return null
        }

        setCreatedItem(persisted)
        setValidationError(null)
        return persisted
      }

      const taskText = form.taskText.trim()
      const title = deriveTaskTitle(taskText, form.title).trim()

      if (!taskText) {
        setValidationError(messages.emptyTaskText)
        return null
      }

      if (!title) {
        setValidationError(messages.emptyTitle)
        return null
      }

      const expected = form.expectedOutput.trim()
      const structuredPayload = buildStructuredPayloadFromQuickForm({
        expectedOutput: expected,
        templateId: form.templateId,
      })

      const item = createEmployeeWorkItem({
        employeeId,
        title,
        taskText,
        summary: expected || null,
        priority: form.priority,
        structuredPayload,
      })

      const persisted = getEmployeeWorkItemById(item.id)
      if (!persisted) {
        setSubmitError(messages.persistFailed)
        return null
      }

      setCreatedItem(persisted)
      setValidationError(null)
      return persisted
    },
    [complexForm, form, taskMode],
  )

  const startWorkday = useCallback(() => {
    startEmployeeOperatingDay(resolveCanonicalEmployeeId(form.employeeId))
  }, [form.employeeId])

  const employees = useMemo(() => MOBILE_RUN_TASK_EMPLOYEES, [])

  const isMaxEmployee = resolveCanonicalEmployeeId(form.employeeId) === MAX_WORKER_EMPLOYEE_ID

  const maxEmployeeHref = `/mobile/employees/${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`

  return {
    taskMode,
    changeTaskMode,
    form,
    complexForm,
    employees,
    patchForm,
    patchComplexForm,
    selectEmployee,
    applyTemplate,
    applyComplexTemplate,
    submit,
    resetForm,
    startWorkday,
    validationError,
    submitError,
    createdItem,
    isMaxEmployee,
    isFormValid,
    maxEmployeeHref,
    complexTemplates: MOBILE_COMPLEX_TASK_TEMPLATES,
  }
}
