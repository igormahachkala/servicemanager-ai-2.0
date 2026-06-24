import { useCallback, useEffect, useState } from 'react'
import {
  createCustomEmployee,
  duplicateCustomEmployee,
  loadCustomEmployees,
  type CustomEmployee,
  type CustomEmployeeDraft,
} from '../data/customEmployees'

export function useCustomEmployees() {
  const [employees, setEmployees] = useState<CustomEmployee[]>(() => loadCustomEmployees())

  const refresh = useCallback(() => {
    setEmployees(loadCustomEmployees())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ai-company-custom-employees') refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const addEmployee = useCallback(
    (draft: CustomEmployeeDraft): CustomEmployee => {
      const created = createCustomEmployee(draft)
      setEmployees(loadCustomEmployees())
      return created
    },
    [],
  )

  const duplicateEmployee = useCallback(
    (source: CustomEmployee, copyOfLabel: string): CustomEmployee => {
      const created = duplicateCustomEmployee(source, copyOfLabel)
      setEmployees(loadCustomEmployees())
      return created
    },
    [],
  )

  return { employees, addEmployee, duplicateEmployee, refresh }
}
