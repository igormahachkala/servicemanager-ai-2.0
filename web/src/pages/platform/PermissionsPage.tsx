import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { PermissionFilters } from '../../components/permissions/PermissionFilters'
import { PermissionMatrix } from '../../components/permissions/PermissionMatrix'

function MatrixSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="panel uiCard" style={{ display: 'grid', gap: 10 }}>
          <div style={{ height: 18, width: '50%', background: '#eef2ff', borderRadius: 8 }} />
          <div style={{ height: 14, width: '30%', background: '#eef2ff', borderRadius: 8 }} />
          {[0, 1, 2, 3, 4].map((j) => (
            <div key={j} style={{ height: 12, width: '80%', background: '#f1f5f9', borderRadius: 6 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Платформа → Роли и права (read-only). Источник данных — только API. */
export function PermissionsPage() {
  const catalogQ = useQuery({ queryKey: ['permissions-catalog'], queryFn: api.fetchPermissionCatalog })
  const matrixQ = useQuery({ queryKey: ['permissions-matrix'], queryFn: api.fetchPermissionMatrix })

  const [roleFilter, setRoleFilter] = useState('')
  const [companyTypeFilter, setCompanyTypeFilter] = useState('')

  const matrix = matrixQ.data || []
  const catalog = catalogQ.data || []

  const roles = useMemo(() => Array.from(new Set(matrix.map((e) => e.role))).sort(), [matrix])
  const companyTypes = useMemo(
    () => Array.from(new Set(matrix.map((e) => (e.companyType === null ? 'ANY' : e.companyType)))).sort(),
    [matrix],
  )

  const filtered = useMemo(
    () =>
      matrix.filter((e) => {
        if (roleFilter && e.role !== roleFilter) return false
        if (companyTypeFilter) {
          const ct = e.companyType === null ? 'ANY' : e.companyType
          if (ct !== companyTypeFilter) return false
        }
        return true
      }),
    [matrix, roleFilter, companyTypeFilter],
  )

  const isLoading = catalogQ.isLoading || matrixQ.isLoading
  const isError = catalogQ.isError || matrixQ.isError
  const isEmpty = !isLoading && !isError && matrix.length === 0

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h2 style={{ marginBottom: 4 }}>Роли и права</h2>
        <div className="muted small">Матрица доступа пользователей в системе ServiceManager.AI (только просмотр)</div>
      </div>

      <div className="pageHint">
        Это read-only обзор: какие права назначены роли в зависимости от типа компании. Редактирование появится позже.
      </div>

      {isError ? (
        <div className="alert">
          Не удалось загрузить права. {String((catalogQ.error as any)?.message || (matrixQ.error as any)?.message || '')}
        </div>
      ) : null}

      {isLoading ? (
        <MatrixSkeleton />
      ) : isEmpty ? (
        <div className="panel"><div className="muted small">Нет данных о правах.</div></div>
      ) : !isError ? (
        <>
          <PermissionFilters
            roles={roles}
            companyTypes={companyTypes}
            roleFilter={roleFilter}
            companyTypeFilter={companyTypeFilter}
            onRoleChange={setRoleFilter}
            onCompanyTypeChange={setCompanyTypeFilter}
          />
          <PermissionMatrix entries={filtered} catalog={catalog} />
        </>
      ) : null}
    </div>
  )
}
