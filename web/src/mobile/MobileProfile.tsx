import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserNotificationsCard } from '../components/BrowserNotificationsCard'
import { SupportContactBlock } from '../components/SupportContactBlock'
import * as api from '../lib/api'
import { canAccessManagementDesktop } from '../lib/navigation'
import { getPendingAndFailedCounts, subscribeOfflineQueue } from './offlineQueue'
import { mobilePath } from './mobileRoute'

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

export function MobileProfile() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const [queueCounts, setQueueCounts] = useState(() => getPendingAndFailedCounts())
  useEffect(() => {
    const refresh = () => setQueueCounts(getPendingAndFailedCounts())
    refresh()
    return subscribeOfflineQueue(refresh)
  }, [])
  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: () => api.getLinkedClients(),
    enabled: !!meQ.data && meQ.data.role !== 'TECHNICIAN',
  })

  const linkedClientCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const observerCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const managementHref = useMemo(() => {
    if (!meQ.data) return '/board'
    return api.appendScopeToPath(
      '/board',
      {
        linkedClientCompanyId: linkedClientCompanyId || undefined,
        companyId: observerCompanyId || undefined,
      },
      meQ.data,
    )
  }, [linkedClientCompanyId, observerCompanyId, meQ.data])

  const techBoundLabelQ = useQuery({
    queryKey: ['mobile-profile-technician-bound', linkedClientCompanyId, meQ.data?.id],
    queryFn: () => api.getTechnicianBoundContexts(linkedClientCompanyId),
    enabled: !!meQ.data && meQ.data.role === 'TECHNICIAN' && !!linkedClientCompanyId,
  })

  const linkedClientName = useMemo(() => {
    if (!linkedClientCompanyId) return ''
    if (meQ.data?.role === 'TECHNICIAN') {
      const rows = techBoundLabelQ.data || []
      const hit = rows.find((c) => (c.clientCompany?.id || '').trim() === linkedClientCompanyId)
      return (hit?.clientCompany?.name || '').trim()
    }
    const row = linkedClientsQ.data?.find((c) => c.clientCompany.id === linkedClientCompanyId)
    const name = row?.clientCompany.name?.trim()
    return name || ''
  }, [linkedClientCompanyId, linkedClientsQ.data, meQ.data?.role, techBoundLabelQ.data])

  const statsBoardQ = useQuery({
    queryKey: ['mobile-profile-board', linkedClientCompanyId, observerCompanyId],
    queryFn: () =>
      api.board({
        linkedClientCompanyId: linkedClientCompanyId || undefined,
        companyId: observerCompanyId || undefined,
        take: 200,
      }),
    enabled: !!meQ.data,
  })

  const stats = useMemo(() => {
    const cols = statsBoardQ.data?.columns || []
    const totalFor = (status: string) => cols.find((c) => c.status === status)?.total ?? null
    return {
      assigned: totalFor('ASSIGNED'),
      inProgress: totalFor('IN_PROGRESS'),
      done: totalFor('DONE'),
    }
  }, [statsBoardQ.data])
  const statsReady = statsBoardQ.isSuccess && !!statsBoardQ.data
  const fmtStat = (n: number | null) => (statsReady && n != null ? String(n) : '—')

  const appContour = useMemo(() => {
    if (typeof window === 'undefined') return '—'
    const h = window.location.hostname
    if (h.includes('194.67.101.37') || h.includes('stage')) return 'Stage'
    if (h.includes('servicemanagerai.ru')) return 'Production'
    if (h === 'localhost' || h === '127.0.0.1') return 'Локально'
    return h || '—'
  }, [])

  function logout() {
    const params = new URLSearchParams()
    params.set('next', mobilePath(location.pathname, ''))
    params.set('mode', 'mobile')
    const linked = (new URLSearchParams(location.search).get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
    const observer = (new URLSearchParams(location.search).get('companyId') || api.getObserverCompanyId()).trim()
    if (linked) params.set('linkedClientCompanyId', linked)
    if (observer) params.set('companyId', observer)

    const suffix = params.toString()
    const target = suffix ? `/login?${suffix}` : '/login'

    api.clearToken()
    queryClient.clear()

    if (typeof window !== 'undefined') {
      window.location.assign(target)
    }
  }

  const fullName = [meQ.data?.firstName, meQ.data?.lastName].filter(Boolean).join(' ').trim()
  const initials = fullName
    ? fullName.split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (meQ.data?.email || '?')[0].toUpperCase()
  const notificationsPath = mobilePath(location.pathname, '/notifications')

  return (
    <div className="mobileSection">
      {meQ.isError ? <div className="mobileNotice mobileNoticeError">{String((meQ.error as any)?.message || meQ.error)}</div> : null}

      {/* Hero card */}
      <div className="mobileProfileHero">
        <div className="mobileProfileAvatar">{initials}</div>
        <div className="mobileProfileName">{fullName || meQ.data?.email || '—'}</div>
        <span className="mobileProfileRoleBadge">{roleLabel(meQ.data?.role)}</span>
        {meQ.data?.companyName ? <div className="mobileProfileCompany">{meQ.data.companyName}</div> : null}
        {linkedClientCompanyId ? (
          <div className="mobileProfileLinkedClient">
            {(meQ.data?.role === 'TECHNICIAN' ? techBoundLabelQ.isLoading : linkedClientsQ.isLoading)
              ? 'Загрузка клиента…'
              : linkedClientName || linkedClientCompanyId}
          </div>
        ) : null}
        {meQ.data?.phone ? (
          <div className="mobileProfileCompany" style={{ marginTop: 4 }}>{meQ.data.phone}</div>
        ) : null}
      </div>

      {/* Stats */}
      <div className="mobileCard mobileProfileStats" aria-label="Статистика заявок">
        <div className="mobileProfileStat">
          <div className="mobileProfileStatValue">{fmtStat(stats.assigned)}</div>
          <div className="mobileProfileStatLabel">Назначено</div>
        </div>
        <div className="mobileProfileStat">
          <div className="mobileProfileStatValue">{fmtStat(stats.inProgress)}</div>
          <div className="mobileProfileStatLabel">В работе</div>
        </div>
        <div className="mobileProfileStat">
          <div className="mobileProfileStatValue">{fmtStat(stats.done)}</div>
          <div className="mobileProfileStatLabel">Завершено</div>
        </div>
      </div>

      {/* Menu */}
      <div className="mobileCard mobileProfileMenu">
        <Link to={notificationsPath} className="mobileProfileMenuItem">
          <span>Уведомления</span>
          <span className="mobileProfileMenuChevron">›</span>
        </Link>
        <Link to={mobilePath(location.pathname, '/offline-queue')} className="mobileProfileMenuItem">
          <span>
            Очередь отправки
            {queueCounts.pending + queueCounts.failed > 0 ? (
              <span className="mobileProfileMenuBadge mobileProfileMenuBadge--queue">
                {queueCounts.pending + queueCounts.failed}
              </span>
            ) : null}
          </span>
          <span className="mobileProfileMenuChevron">›</span>
        </Link>
        <div className="mobileProfileMenuItem mobileProfileMenuItem--static" aria-disabled="true">
          <span>Режим работы</span>
          <span className="mobileProfileMenuSoon">Скоро</span>
        </div>
        {canAccessManagementDesktop(meQ.data?.role) ? (
          <Link to={managementHref} className="mobileProfileMenuItem">
            <span>Управленческая часть</span>
            <span className="mobileProfileMenuChevron">›</span>
          </Link>
        ) : null}
        <button type="button" className="mobileProfileMenuItem mobileProfileMenuItem--danger" onClick={logout}>
          <span>Выйти</span>
        </button>
      </div>

      {/* Support + notifications */}
      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Поддержка</div>
        <div className="mobileFieldHint" style={{ marginBottom: 8 }}>
          Telegram и MAX — внешние чаты поддержки (откроются в браузере или приложении).
        </div>
        <SupportContactBlock titleTag="div" />
      </div>

      <div className="mobileCard" style={{ marginTop: 8 }}>
        <BrowserNotificationsCard
          title="Push-уведомления браузера"
          description="Системные уведомления для realtime-событий, пока приложение открыто."
        />
      </div>

      {/* Specializations */}
      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Мои специализации</div>
        <div className="mobileFieldHint">Специализации будут доступны позже.</div>
      </div>

      {/* App info */}
      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>О приложении</div>
        <div className="mobileProfileInfoRow">
          <span className="mobileMeta">Контур</span>
          <span>{appContour}</span>
        </div>
        <div className="mobileProfileInfoRow">
          <span className="mobileMeta">Версия</span>
          <span>Mobile Workspace V1</span>
        </div>
      </div>
    </div>
  )
}
