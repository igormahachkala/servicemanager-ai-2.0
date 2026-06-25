import { useCallback, useEffect, useState } from 'react'
import {
  createCompany,
  getCompanyById,
  loadCompanies,
  updateCompany,
} from '../domain/company/companyStorage'
import type { CreateCompanyInput, UpdateCompanyInput } from '../domain/company/company'
import { initializeCompanyEngine } from '../domain/company/companyMigration'
import type { Company } from '../domain/company/company'

const STORAGE_KEY = 'ai-company-companies'

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>(() => {
    initializeCompanyEngine()
    return loadCompanies()
  })

  const refresh = useCallback(() => {
    initializeCompanyEngine()
    setCompanies(loadCompanies())
  }, [])

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const create = useCallback((input: CreateCompanyInput): Company => {
    const created = createCompany(input)
    setCompanies(loadCompanies())
    return created
  }, [])

  const update = useCallback((id: string, patch: UpdateCompanyInput): Company | null => {
    const updated = updateCompany(id, patch)
    setCompanies(loadCompanies())
    return updated
  }, [])

  const getById = useCallback((id: string): Company | null => {
    return getCompanyById(id)
  }, [])

  return { companies, create, update, getById, refresh }
}
