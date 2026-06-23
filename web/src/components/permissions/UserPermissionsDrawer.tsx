import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  putPermissionsUserOverrides,
  type PermissionsUserRow,
} from '../../lib/permissions-api'
import {
  buildPermissionCounters,
  buildPermissionModules,
  PERMISSION_MODULES,
  permissionLabel,
} from '../../lib/permissions-constructor'
import { PermissionAuditPanel } from './PermissionAuditPanel'
import { PermissionCountersStrip, PermissionModuleBlocks } from './PermissionModuleBlocks'

export type DrawerTab = 'effective' | 'overrides' | 'scopes' | 'audit'

type DrawerQueries = {
  effectiveQ: { isFetching: boolean; isError: boolean; error: unknown; data: any }
  overridesQ: { isFetching: boolean; isError: boolean; error: unknown; data: any }
  scopesQ: { isFetching: boolean; isError: boolean; error: unknown; data: any }
}

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

function scopeModeLabel(mode?: string) {
  if (mode === 'bound_locations') return 'Привязанные локации'
  if (mode === 'tenant_wide') return 'Вся компания'
  return '—'
}

function ScopesPanel({ data, loading, error }: { data: any; loading: boolean; error: unknown }) {
  if (loading) return <div className="permPanelEmpty muted">Загружаем scopes…</div>
  if (error) return <div className="alert">{(error as any)?.message || String(error)}</div>
  if (!data) return <div className="permPanelEmpty muted">Нет данных по scopes</div>

  const scope = data?.scope || {}
  const operational = scope?.operational
  const bindings = scope?.locationBindings?.companies || []

  return (
    <div className="permScopesPanel">
      <div className="permScopeCard">
        <div className="permScopeTitle">Базовый scope</div>
        <dl className="permScopeDl">
          <div>
            <dt>Роль</dt>
            <dd>{roleLabel(data?.role)}</dd>
          </div>
          <div>
            <dt>Исполнитель</dt>
            <dd>{data?.isExecutor ? 'Да' : 'Нет'}</dd>
          </div>
          <div>
            <dt>Тип компании</dt>
            <dd>{scope?.companyType || '—'}</dd>
          </div>
          <div>
            <dt>Связанные клиенты</dt>
            <dd>{asCount(scope?.linkedClientCompanyIds)}</dd>
          </div>
        </dl>
      </div>

      {bindings.length > 0 ? (
        <div className="permScopeCard">
          <div className="permScopeTitle">Привязки локаций</div>
          <ul className="permScopeList">
            {bindings.map((row: any) => (
              <li key={row.companyId} className="permScopeListItem">
                <div className="permScopeListHead">
                  <span className="permScopeCompany">{shortId(row.companyId)}</span>
                  <span className="uxBadge uxBadgeNeutral">{scopeModeLabel(row.mode)}</span>
                </div>
                <div className="muted small">
                  Локаций: {Array.isArray(row.locationIds) ? row.locationIds.length : 0}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="permScopeCard muted small">Привязки локаций не заданы — tenant-wide доступ.</div>
      )}

      {operational ? (
        <div className="permScopeCard">
          <div className="permScopeTitle">Operational scope</div>
          <div className="muted small" style={{ marginBottom: 8 }}>
            Сводка для исполнителя без раскрытия внутренних идентификаторов.
          </div>
          <dl className="permScopeDl">
            <div>
              <dt>Режим</dt>
              <dd>{operational?.mode || '—'}</dd>
            </div>
            <div>
              <dt>Локаций в scope</dt>
              <dd>{asCount(operational?.locationIds)}</dd>
            </div>
            <div>
              <dt>Клиентских компаний</dt>
              <dd>{asCount(operational?.clientCompanyIds)}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  )
}

function asCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0
}

function shortId(value?: string) {
  if (!value) return '—'
  if (value.length <= 12) return value
  return `${value.slice(0, 8)}…`
}

type Props = {
  user: PermissionsUserRow
  tab: DrawerTab
  onTabChange: (tab: DrawerTab) => void
  onClose: () => void
  scopeCompanyId?: string
  overridesWriteEnabled: boolean
  queries: DrawerQueries
  effectiveCodes: string[]
  overrideCodes: string[]
  roleCodes: string[]
}

export function UserPermissionsDrawer({
  user,
  tab,
  onTabChange,
  onClose,
  scopeCompanyId,
  overridesWriteEnabled,
  queries,
  effectiveCodes,
  overrideCodes,
  roleCodes,
}: Props) {
  const queryClient = useQueryClient()
  const [draftOverrides, setDraftOverrides] = useState<string[] | null>(null)
  const [reason, setReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const counters = useMemo(
    () => buildPermissionCounters(roleCodes, overrideCodes, effectiveCodes),
    [roleCodes, overrideCodes, effectiveCodes],
  )

  const modules = useMemo(
    () =>
      buildPermissionModules(roleCodes, overrideCodes, effectiveCodes, {
        roleDetails: queries.effectiveQ.data?.details?.rolePermissions,
        overrideDetails: queries.overridesQ.data?.overrides,
      }),
    [roleCodes, overrideCodes, effectiveCodes, queries.effectiveQ.data, queries.overridesQ.data],
  )

  const overrideModules = useMemo(
    () => PERMISSION_MODULES.filter((module) => module.codes.length > 0),
    [],
  )

  const selectedOverrides = draftOverrides ?? overrideCodes

  const saveMutation = useMutation({
    mutationFn: () =>
      putPermissionsUserOverrides(
        user.id,
        { grantPermissionCodes: selectedOverrides, reason: reason.trim() },
        scopeCompanyId,
      ),
    onSuccess: async () => {
      setConfirmOpen(false)
      setReason('')
      setDraftOverrides(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['permissions-users'] }),
        queryClient.invalidateQueries({ queryKey: ['permissions-user-effective', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['permissions-user-overrides', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['permissions-user-audit', user.id] }),
      ])
    },
  })

  const dirty =
    overridesWriteEnabled &&
    draftOverrides !== null &&
    JSON.stringify([...draftOverrides].sort()) !== JSON.stringify([...overrideCodes].sort())

  function toggleOverride(code: string) {
    setDraftOverrides((prev) => {
      const base = prev ?? [...overrideCodes]
      return base.includes(code) ? base.filter((item) => item !== code) : [...base, code]
    })
  }

  const tabs: Array<{ id: DrawerTab; label: string }> = [
    { id: 'effective', label: 'Effective права' },
    { id: 'overrides', label: 'Overrides' },
    { id: 'scopes', label: 'Scopes' },
    { id: 'audit', label: 'Аудит' },
  ]

  return (
    <>
      <div className="permissionsDrawerBackdrop" onClick={onClose} />
      <aside className="permissionsDrawer permissionsDrawerConstructor" aria-label="Права пользователя">
        <header className="permDrawerHeader">
          <div>
            <div className="permDrawerName">{displayName(user)}</div>
            <div className="muted small">{user.email}</div>
            <div className="permDrawerMeta">
              <span className="uxBadge uxBadgeNeutral">{roleLabel(user.role)}</span>
              <span className={user.isActive ? 'uxBadge uxBadgeSuccess' : 'uxBadge uxBadgeWarn'}>
                {user.isActive ? 'Активен' : 'Неактивен'}
              </span>
              {!overridesWriteEnabled ? (
                <span className="uxBadge permReadOnlyBadge">Read-only</span>
              ) : null}
            </div>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <PermissionCountersStrip counters={counters} />

        <div className="permDrawerTabs" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'permTab permTabActive' : 'permTab'}
              onClick={() => onTabChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'effective' ? (
          <div className="permDrawerPanel">
            {queries.effectiveQ.isFetching ? <div className="permPanelLoading muted">Загрузка effective…</div> : null}
            {queries.effectiveQ.isError ? (
              <div className="alert">{(queries.effectiveQ.error as any)?.message || String(queries.effectiveQ.error)}</div>
            ) : null}
            {!queries.effectiveQ.isFetching && effectiveCodes.length === 0 ? (
              <div className="permPanelEmpty muted">У пользователя нет effective прав в каталоге.</div>
            ) : (
              <PermissionModuleBlocks modules={modules} />
            )}
          </div>
        ) : null}

        {tab === 'overrides' ? (
          <div className="permDrawerPanel">
            {queries.overridesQ.isFetching ? <div className="permPanelLoading muted">Загрузка overrides…</div> : null}
            {queries.overridesQ.isError ? (
              <div className="alert">{(queries.overridesQ.error as any)?.message || String(queries.overridesQ.error)}</div>
            ) : null}

            {!overridesWriteEnabled ? (
              overrideCodes.length === 0 ? (
                <div className="permPanelEmpty muted">User overrides не заданы — права только от роли.</div>
              ) : (
                <div className="permOverrideReadList">
                  {overrideCodes.map((code) => (
                    <div key={code} className="permCodeRow">
                      <div>
                        <div className="permCodeTitle">{permissionLabel(code)}</div>
                        <div className="permCodeMeta">{code}</div>
                      </div>
                      <span className="permState permStateOverride">Override</span>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                <div className="pageHint">Редактируются только user overrides. Матрица ролей недоступна.</div>
                <div className="permOverrideEditor">
                  {overrideModules.map((module) => (
                    <section key={module.id} className="permModuleCard">
                      <div className="permModuleTitle">{module.title}</div>
                      <ul className="permToggleList">
                        {module.codes.map((entry) => {
                          const checked = selectedOverrides.includes(entry.code)
                          const fromRole = roleCodes.includes(entry.code)
                          return (
                            <li key={entry.code} className="permToggleRow">
                              <label className="permToggleLabel">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOverride(entry.code)}
                                />
                                <span>
                                  <span className="permCodeTitle">{entry.label}</span>
                                  <span className="permCodeMeta">{entry.code}</span>
                                  {fromRole && !checked ? (
                                    <span className="muted small"> Уже есть от роли</span>
                                  ) : null}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ))}
                </div>

                <label className="permReasonField">
                  <span>Причина изменения (обязательно)</span>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Опишите, зачем меняются overrides"
                  />
                </label>

                <div className="permDrawerActions">
                  <button
                    type="button"
                    className="primary"
                    disabled={!dirty || !reason.trim() || saveMutation.isPending}
                    onClick={() => setConfirmOpen(true)}
                  >
                    Сохранить overrides
                  </button>
                  {dirty ? (
                    <button type="button" className="ghost" onClick={() => setDraftOverrides(null)}>
                      Сбросить
                    </button>
                  ) : null}
                </div>

                {saveMutation.isError ? (
                  <div className="alert">{(saveMutation.error as any)?.message || String(saveMutation.error)}</div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {tab === 'scopes' ? (
          <div className="permDrawerPanel">
            <ScopesPanel
              data={queries.scopesQ.data}
              loading={queries.scopesQ.isFetching}
              error={queries.scopesQ.isError ? queries.scopesQ.error : null}
            />
          </div>
        ) : null}

        {tab === 'audit' ? (
          <div className="permDrawerPanel">
            <PermissionAuditPanel user={user} scopeCompanyId={scopeCompanyId} active={tab === 'audit'} />
          </div>
        ) : null}
      </aside>

      {confirmOpen ? (
        <>
          <div className="permissionsDrawerBackdrop" style={{ zIndex: 90 }} onClick={() => setConfirmOpen(false)} />
          <div className="permConfirmDialog" role="dialog" aria-modal="true">
            <h3>Подтвердите сохранение overrides</h3>
            <p className="muted small">
              Будут записаны {selectedOverrides.length} override(s) для {displayName(user)}.
            </p>
            <p className="muted small">Причина: {reason.trim()}</p>
            <div className="permDrawerActions">
              <button
                type="button"
                className="primary"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? 'Сохранение…' : 'Подтвердить'}
              </button>
              <button type="button" className="ghost" onClick={() => setConfirmOpen(false)}>
                Отмена
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
