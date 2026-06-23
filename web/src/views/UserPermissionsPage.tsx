import { useMemo, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { UserPermissionsDrawer, type DrawerTab } from '../components/permissions/UserPermissionsDrawer'
import { usePermissionsWriteCapability } from '../hooks/usePermissionsWriteCapability'
import * as api from '../lib/api'
import {
  extractEffectiveCodes,
  extractOverrideCodes,
  extractRoleCodes,
  getPermissionsUserEffective,
  getPermissionsUserOverrides,
  getPermissionsUserScopes,
  getPermissionsUsers,
  type PermissionsUserRow,
} from '../lib/permissions-api'

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Все роли' },
  { value: 'ADMIN', label: 'Администратор' },
  { value: 'DISPATCHER', label: 'Диспетчер' },
  { value: 'MASTER', label: 'Мастер' },
  { value: 'TECHNICIAN', label: 'Техник' },
  { value: 'CLIENT', label: 'Клиент' },
  { value: 'STAFF', label: 'Сотрудник' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Любой статус' },
  { value: 'active', label: 'Активные' },
  { value: 'inactive', label: 'Неактивные' },
]

const OVERRIDE_FILTER_OPTIONS = [
  { value: '', label: 'Все overrides' },
  { value: 'yes', label: 'С overrides' },
  { value: 'no', label: 'Без overrides' },
]

function roleLabel(role?: string) {
  if (!role) return '—'
  if (role === 'PLATFORM_ADMIN') return 'Администратор платформы'
  if (role === 'ADMIN') return 'Администратор'
  if (role === 'DISPATCHER') return 'Диспетчер'
  if (role === 'MASTER') return 'Мастер'
  if (role === 'TECHNICIAN') return 'Техник'
  if (role === 'CLIENT') return 'Клиент'
  if (role === 'TERRITORIAL_MANAGER') return 'Территориальный менеджер'
  if (role === 'NETWORK_DIRECTOR') return 'Сетевой директор'
  if (role === 'STAFF') return 'Сотрудник'
  return role
}

function displayName(user: PermissionsUserRow) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email
}

function companyTypeLabel(type?: string) {
  if (!type) return '—'
  if (type === 'PROVIDER') return 'Провайдер'
  if (type === 'CLIENT') return 'Клиент'
  if (type === 'PLATFORM') return 'Платформа'
  return type
}

function scopeSummaryLabel(summary?: PermissionsUserRow['scopeSummary']) {
  if (!summary) return '—'
  const mode = summary.mode === 'bound_locations' ? 'Локации' : 'Tenant-wide'
  return `${mode} · клиентов: ${summary.linkedClientCount}`
}

export function UserPermissionsPage() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [overrideFilter, setOverrideFilter] = useState('')
  const [selected, setSelected] = useState<PermissionsUserRow | null>(null)
  const [tab, setTab] = useState<DrawerTab>('effective')

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const observerCompanyId = useMemo(() => {
    if (meQ.data?.role !== 'PLATFORM_ADMIN') return ''
    const sp = new URLSearchParams(location.search)
    return (sp.get('companyId') || '').trim()
  }, [location.search, meQ.data?.role])

  const canReadPermissions = meQ.data?.role === 'PLATFORM_ADMIN' || meQ.data?.role === 'ADMIN'
  const scopeCompanyId = meQ.data?.role === 'PLATFORM_ADMIN' ? observerCompanyId || undefined : undefined
  const writeCapabilityQ = usePermissionsWriteCapability(scopeCompanyId, canReadPermissions)
  const overridesWriteEnabled = writeCapabilityQ.data === true

  const listFilters = useMemo(() => {
    const isActive =
      statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined
    const hasOverrides =
      overrideFilter === 'yes' ? true : overrideFilter === 'no' ? false : undefined
    return {
      companyId: scopeCompanyId,
      q: search.trim() || undefined,
      role: roleFilter || undefined,
      isActive,
      hasOverrides,
    }
  }, [scopeCompanyId, search, roleFilter, statusFilter, overrideFilter])

  const listQ = useQuery({
    queryKey: ['permissions-users', listFilters],
    queryFn: () => getPermissionsUsers(listFilters),
    enabled: canReadPermissions,
  })

  const effectiveQ = useQuery({
    queryKey: ['permissions-user-effective', selected?.id, scopeCompanyId],
    queryFn: () => getPermissionsUserEffective(selected!.id, scopeCompanyId),
    enabled: !!selected && canReadPermissions,
  })

  const overridesQ = useQuery({
    queryKey: ['permissions-user-overrides', selected?.id, scopeCompanyId],
    queryFn: () => getPermissionsUserOverrides(selected!.id, scopeCompanyId),
    enabled: !!selected && canReadPermissions,
  })

  const scopesQ = useQuery({
    queryKey: ['permissions-user-scopes', selected?.id, scopeCompanyId],
    queryFn: () => getPermissionsUserScopes(selected!.id, scopeCompanyId),
    enabled: !!selected && canReadPermissions,
  })

  const users = listQ.data?.users || []
  const companyMeta = listQ.data?.meta

  const effectiveCodes = useMemo(() => {
    if (!selected) return []
    const detailed = extractEffectiveCodes(effectiveQ.data)
    if (detailed.length > 0) return detailed
    return selected.effectiveCodes
  }, [selected, effectiveQ.data])

  const overrideCodes = useMemo(() => {
    if (!selected) return []
    const detailed = extractOverrideCodes(overridesQ.data)
    if (detailed.length > 0) return detailed
    return selected.overrideCodes
  }, [selected, overridesQ.data])

  const roleCodes = useMemo(() => extractRoleCodes(effectiveQ.data), [effectiveQ.data])

  if (meQ.isLoading) {
    return (
      <div className="permPage">
        <div className="panel permLoadingPanel">Проверяем доступ…</div>
      </div>
    )
  }

  if (!canReadPermissions) return <Navigate to={api.getHomeRoute(meQ.data?.role)} replace />

  return (
    <div className="permPage">
      <header className="permPageHeader">
        <div>
          <h2 className="permPageTitle">Права пользователей</h2>
          <p className="muted small permPageSubtitle">
            Конструктор PBAC: effective права, overrides, scopes и аудит (read-only просмотр).
          </p>
        </div>
        <div className="permPageBadges">
          {writeCapabilityQ.isLoading ? (
            <span className="uxBadge uxBadgeNeutral">Проверка API…</span>
          ) : overridesWriteEnabled ? (
            <span className="uxBadge uxBadgeSuccess">Overrides editing enabled</span>
          ) : (
            <span className="uxBadge permReadOnlyBadge">Read-only mode</span>
          )}
        </div>
      </header>

      <div className="panel permFiltersPanel">
        <div className="permFiltersGrid">
          <label className="permFilterField">
            <span className="muted small">Поиск</span>
            <input
              placeholder="Email, имя"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="permFilterField">
            <span className="muted small">Роль</span>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {ROLE_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="permFilterField">
            <span className="muted small">Статус</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="permFilterField">
            <span className="muted small">Overrides</span>
            <select value={overrideFilter} onChange={(e) => setOverrideFilter(e.target.value)}>
              {OVERRIDE_FILTER_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="permFiltersFooter">
          <div className="muted small">
            {listQ.isFetching ? 'Загрузка…' : `Пользователей: ${users.length}`}
            {typeof companyMeta?.total === 'number' ? ` · всего в tenant: ${companyMeta.total}` : null}
            {companyMeta?.companyType ? ` · ${companyTypeLabel(companyMeta.companyType)}` : null}
          </div>
          <button type="button" className="ghost" onClick={() => listQ.refetch()} disabled={listQ.isFetching}>
            Обновить
          </button>
        </div>
      </div>

      {listQ.isError ? <div className="alert">{(listQ.error as any)?.message || String(listQ.error)}</div> : null}

      <div className="panel permTablePanel">
        {listQ.isLoading ? (
          <div className="permPanelEmpty muted">Загружаем пользователей…</div>
        ) : users.length === 0 ? (
          <div className="permPanelEmpty">
            <div className="permEmptyTitle">Пользователи не найдены</div>
            <div className="muted small">Измените фильтры или сбросьте поиск.</div>
          </div>
        ) : (
          <div className="permTableWrap">
            <table className="permTable">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Компания / scope</th>
                  <th>Effective</th>
                  <th>Overrides</th>
                  <th>Статус</th>
                  <th className="permTableActionsCol">Детали</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={selected?.id === user.id ? 'permTableRowActive' : undefined}>
                    <td>
                      <div className="permUserName">{displayName(user)}</div>
                      <div className="muted small">{user.email}</div>
                    </td>
                    <td>{roleLabel(user.role)}</td>
                    <td>
                      <div>{companyTypeLabel(companyMeta?.companyType)}</div>
                      <div className="muted small">{scopeSummaryLabel(user.scopeSummary)}</div>
                    </td>
                    <td>{user.effectivePermissionsCount ?? user.effectiveCodes.length}</td>
                    <td>{user.overridesCount ?? user.overrideCodes.length}</td>
                    <td>
                      <span className={user.isActive ? 'uxBadge uxBadgeSuccess' : 'uxBadge uxBadgeWarn'}>
                        {user.isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td className="permTableActionsCol">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setSelected(user)
                          setTab('effective')
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? (
        <UserPermissionsDrawer
          user={selected}
          tab={tab}
          onTabChange={setTab}
          onClose={() => setSelected(null)}
          scopeCompanyId={scopeCompanyId}
          overridesWriteEnabled={overridesWriteEnabled}
          queries={{ effectiveQ, overridesQ, scopesQ }}
          effectiveCodes={effectiveCodes}
          overrideCodes={overrideCodes}
          roleCodes={roleCodes}
        />
      ) : null}
    </div>
  )
}
