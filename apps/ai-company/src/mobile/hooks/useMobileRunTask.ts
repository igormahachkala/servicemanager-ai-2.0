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

export type MobileRunTaskValidationMessages = {
  emptyTaskText: string
  emptyTitle: string
  persistFailed: string
}

export function useMobileRunTask() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<MobileRunTaskFormState>(() => ({
    ...DEFAULT_FORM,
    employeeId: resolveInitialEmployee(searchParams.get('employee')),
  }))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdItem, setCreatedItem] = useState<WorkItem | null>(null)

  const templateParam = searchParams.get('template')

  const patchForm = useCallback((patch: Partial<MobileRunTaskFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
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

  useEffect(() => {
    if (!templateParam || !isMobileTaskTemplateId(templateParam)) return
    applyTemplate(templateParam)
  }, [applyTemplate, templateParam])

  const resetForm = useCallback(() => {
    setForm({
      ...DEFAULT_FORM,
      employeeId: form.employeeId,
    })
    setValidationError(null)
    setSubmitError(null)
    setCreatedItem(null)
  }, [form.employeeId])

  const isFormValid = useMemo(
    () => isMobileRunTaskFormValid(form.title, form.taskText),
    [form.title, form.taskText],
  )

  const submit = useCallback(
    (messages: MobileRunTaskValidationMessages) => {
      setSubmitError(null)

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

      const employeeId = resolveCanonicalEmployeeId(form.employeeId)
      const expected = form.expectedOutput.trim()

      const item = createEmployeeWorkItem({
        employeeId,
        title,
        taskText,
        summary: expected || null,
        priority: form.priority,
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
    [form],
  )

  const startWorkday = useCallback(() => {
    startEmployeeOperatingDay(resolveCanonicalEmployeeId(form.employeeId))
  }, [form.employeeId])

  const employees = useMemo(() => MOBILE_RUN_TASK_EMPLOYEES, [])

  const isMaxEmployee = resolveCanonicalEmployeeId(form.employeeId) === MAX_WORKER_EMPLOYEE_ID

  const maxEmployeeHref = `/mobile/employees/${encodeURIComponent(MAX_WORKER_EMPLOYEE_ID)}`

  return {
    form,
    employees,
    patchForm,
    selectEmployee,
    applyTemplate,
    submit,
    resetForm,
    startWorkday,
    validationError,
    submitError,
    createdItem,
    isMaxEmployee,
    isFormValid,
    maxEmployeeHref,
  }
}
