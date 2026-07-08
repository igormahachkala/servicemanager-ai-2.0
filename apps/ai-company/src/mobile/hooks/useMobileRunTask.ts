import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createEmployeeWorkItem,
  type WorkItem,
  type WorkPriority,
} from '../../domain/employeeWorkQueue'
import { startEmployeeOperatingDay } from '../../domain/employeeOperatingDay'
import { resolveCanonicalEmployeeId } from '../../mission-control/data/employeeIdResolver'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import {
  deriveTaskTitle,
  findMobileTaskTemplate,
  isEnabledMobileRunTaskEmployee,
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

export function useMobileRunTask() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<MobileRunTaskFormState>(() => ({
    ...DEFAULT_FORM,
    employeeId: resolveInitialEmployee(searchParams.get('employee')),
  }))
  const [validationError, setValidationError] = useState<string | null>(null)
  const [createdItem, setCreatedItem] = useState<WorkItem | null>(null)

  const patchForm = useCallback((patch: Partial<MobileRunTaskFormState>) => {
    setForm((current) => ({ ...current, ...patch }))
    setValidationError(null)
  }, [])

  const selectEmployee = useCallback((employeeId: string) => {
    if (!isEnabledMobileRunTaskEmployee(employeeId)) return
    patchForm({ employeeId })
  }, [patchForm])

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

  const resetForm = useCallback(() => {
    setForm({
      ...DEFAULT_FORM,
      employeeId: form.employeeId,
    })
    setValidationError(null)
    setCreatedItem(null)
  }, [form.employeeId])

  const submit = useCallback(
    (emptyTaskError: string) => {
      const taskText = form.taskText.trim()
      if (!taskText) {
        setValidationError(emptyTaskError)
        return null
      }

      const title = deriveTaskTitle(taskText, form.title)
      const expected = form.expectedOutput.trim()

      const item = createEmployeeWorkItem({
        employeeId: form.employeeId,
        title,
        taskText,
        summary: expected || null,
        priority: form.priority,
      })

      setCreatedItem(item)
      setValidationError(null)
      return item
    },
    [form],
  )

  const startWorkday = useCallback(() => {
    startEmployeeOperatingDay(form.employeeId)
  }, [form.employeeId])

  const employees = useMemo(() => MOBILE_RUN_TASK_EMPLOYEES, [])

  const isMaxEmployee = form.employeeId === MAX_WORKER_EMPLOYEE_ID

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
    createdItem,
    isMaxEmployee,
  }
}
