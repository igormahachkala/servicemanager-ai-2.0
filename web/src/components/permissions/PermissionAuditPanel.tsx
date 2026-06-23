import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  getPermissionsUserAudit,
  type PermissionsAuditUserRef,
  type PermissionsUserRow,
} from '../../lib/permissions-api'
import { permissionLabel } from '../../lib/permissions-constructor'

const PAGE_SIZE = 10

type Props = {
  user: PermissionsUserRow
  scopeCompanyId?: string
  active: boolean
}

function personName(user?: PermissionsAuditUserRef | PermissionsUserRow | null) {
  if (!user) return '—'
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.email || '—'
}

function formatAuditDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function PermissionCodeList({
  codes,
  variant,
}: {
  codes: string[]
  variant: 'added' | 'removed'
}) {
  if (codes.length === 0) return null

  return (
    <div className="permAuditChangeBlock">
      <div className="permAuditChangeTitle">{variant === 'added' ? 'Добавлено:' : 'Удалено:'}</div>
      <ul className="permAuditCodeList">
        {codes.map((code) => (
          <li key={code} className={variant === 'added' ? 'permAuditCodeAdded' : 'permAuditCodeRemoved'}>
            <span className="permAuditCodeSign">{variant === 'added' ? '+' : '−'}</span>
            <span className="permAuditCodeLabel">{permissionLabel(code)}</span>
            <span className="permAuditCodeMeta">{code}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PermissionAuditPanel({ user, scopeCompanyId, active }: Props) {
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
  }, [user.id])

  const auditQ = useQuery({
    queryKey: ['permissions-user-audit', user.id, scopeCompanyId, page, PAGE_SIZE],
    queryFn: () =>
      getPermissionsUserAudit(user.id, {
        companyId: scopeCompanyId,
        take: PAGE_SIZE,
        skip: page * PAGE_SIZE,
      }),
    enabled: active && !!user.id,
  })

  const total = auditQ.data?.meta.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = page > 0
  const canNext = (page + 1) * PAGE_SIZE < total

  const targetName = useMemo(() => {
    return personName(auditQ.data?.targetUser || user)
  }, [auditQ.data?.targetUser, user])

  if (!active) return null

  if (auditQ.isLoading) {
    return <div className="permPanelLoading muted">Загружаем историю изменений…</div>
  }

  if (auditQ.isError) {
    return <div className="alert">{(auditQ.error as any)?.message || String(auditQ.error)}</div>
  }

  const items = auditQ.data?.items || []

  if (items.length === 0) {
    return (
      <div className="permPanelEmpty">
        <div className="permEmptyTitle">История пуста</div>
        <div className="muted small">
          Изменений user overrides для {targetName} пока не зафиксировано.
        </div>
      </div>
    )
  }

  return (
    <div className="permAuditPanel">
      <div className="permAuditList">
        {items.map((item) => (
          <article key={item.id} className="permAuditCard">
            <div className="permAuditDate">{formatAuditDate(item.createdAt)}</div>
            <div className="permAuditActor">{personName(item.actor)}</div>
            <div className="permAuditSummary">
              Изменены права пользователя:
              <div className="permAuditTarget">{targetName}</div>
            </div>

            <PermissionCodeList codes={item.addedPermissionCodes} variant="added" />
            <PermissionCodeList codes={item.removedPermissionCodes} variant="removed" />

            {item.reason ? (
              <div className="permAuditReason">
                <div className="permAuditReasonTitle">Причина:</div>
                <div>{item.reason}</div>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="permAuditPagination">
        <div className="muted small">
          Страница {page + 1} из {pageCount} · записей: {total}
        </div>
        <div className="permDrawerActions">
          <button type="button" className="ghost" disabled={!canPrev || auditQ.isFetching} onClick={() => setPage((p) => p - 1)}>
            Назад
          </button>
          <button type="button" className="ghost" disabled={!canNext || auditQ.isFetching} onClick={() => setPage((p) => p + 1)}>
            Далее
          </button>
        </div>
      </div>
    </div>
  )
}
