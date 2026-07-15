import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserNotificationsCard } from '../components/BrowserNotificationsCard'
import { SupportContactBlock } from '../components/SupportContactBlock'
import * as api from '../lib/api'
import { canAccessManagementDesktop } from '../lib/navigation'
import { ClientContourCard } from './ClientContourCard'
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

/** Tabler chevron-right — inline SVG вместо глифа ›. */
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
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
        take: 500,
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
  const roleBadgeTone = meQ.data?.role === 'TECHNICIAN' ? 'tech' : meQ.data?.role === 'CLIENT' ? 'client' : 'admin'
  const notificationsPath = mobilePath(location.pathname, '/notifications')
  const backHref = api.appendScopeToPath(
    mobilePath(location.pathname, ''),
    { linkedClientCompanyId: linkedClientCompanyId || undefined, companyId: observerCompanyId || undefined },
    meQ.data,
  )

  return (
    <>
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink">Назад</Link>
      </div>
      <div className="mobileSection">
        {meQ.isError ? <div className="mobileNotice mobileNoticeError">{String((meQ.error as { message?: string } | null)?.message || meQ.error)}</div> : null}

        {/* Hero card — Figma ProfileScreen: аватар-плитка слева + имя/email/бейджи */}
        <div className="mobileProfileHero">
          <div className="mobileProfileAvatar">{initials}</div>
          <div className="mobileProfileHeroInfo">
            <div className="mobileProfileName">{fullName || meQ.data?.email || '—'}</div>
            {meQ.data?.email && fullName ? <div className="mobileProfileEmail">{meQ.data.email}</div> : null}
            <div className="mobileProfileBadgeRow">
              <span className={`mobileProfileRoleBadge mobileProfileRoleBadge--${roleBadgeTone}`}>{roleLabel(meQ.data?.role)}</span>
              <span className="mobileProfileContourBadge">{appContour}</span>
            </div>
            {meQ.data?.companyName ? <div className="mobileProfileCompany">{meQ.data.companyName}</div> : null}
            {linkedClientCompanyId ? (
              <div className="mobileProfileLinkedClient">
                {(meQ.data?.role === 'TECHNICIAN' ? techBoundLabelQ.isLoading : linkedClientsQ.isLoading)
                  ? 'Загрузка клиента…'
                  : linkedClientName || linkedClientCompanyId}
              </div>
            ) : null}
            {meQ.data?.phone ? <div className="mobileProfileCompany">{meQ.data.phone}</div> : null}
          </div>
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

        {/* Client context — общий компонент (тот же в /m/settings) */}
        <ClientContourCard />

        {/* Menu */}
        <div className="mobileCard mobileProfileMenu">
          <Link to={notificationsPath} className="mobileProfileMenuItem">
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler bell */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">Уведомления</span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </Link>
          <Link to={mobilePath(location.pathname, '/push-settings')} className="mobileProfileMenuItem">
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler bell-ringing */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                <path d="M5 4l-1 1" />
                <path d="M19 4l1 1" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">Push-уведомления</span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </Link>
          <Link to={mobilePath(location.pathname, '/settings')} className="mobileProfileMenuItem">
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler settings (gear) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">Настройки</span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </Link>
          <Link to={mobilePath(location.pathname, '/offline-queue')} className="mobileProfileMenuItem">
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler send */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 14l11 -11" />
                <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">
              Очередь отправки
              {queueCounts.pending + queueCounts.failed > 0 ? (
                <span className="mobileProfileMenuBadge mobileProfileMenuBadge--queue">
                  {queueCounts.pending + queueCounts.failed}
                </span>
              ) : null}
            </span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </Link>
          <div className="mobileProfileMenuItem mobileProfileMenuItem--static" aria-disabled="true">
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler clock */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="12 7 12 12 15 15" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">Режим работы</span>
            <span className="mobileProfileMenuSoon">Скоро</span>
          </div>
          {canAccessManagementDesktop(meQ.data?.role) ? (
            <Link to={managementHref} className="mobileProfileMenuItem">
              <span className="mobileProfileMenuIcon" aria-hidden>
                {/* Tabler layout-dashboard */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="6" height="8" rx="1" />
                  <rect x="4" y="16" width="6" height="4" rx="1" />
                  <rect x="14" y="4" width="6" height="4" rx="1" />
                  <rect x="14" y="12" width="6" height="8" rx="1" />
                </svg>
              </span>
              <span className="mobileProfileMenuLabel">Управленческая часть</span>
              <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
            </Link>
          ) : null}
          <button type="button" className="mobileProfileMenuItem mobileProfileMenuItem--danger" onClick={logout}>
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler logout */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2" />
                <path d="M9 12h12l-3 -3" />
                <path d="M18 15l3 -3" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">Выйти</span>
          </button>
        </div>

        {/* Support — SupportContactBlock self-titles «Поддержка» */}
        <div className="mobileCard" style={{ marginTop: 8 }}>
          <SupportContactBlock titleTag="div" />
          <div className="mobileFieldHint" style={{ marginTop: 8 }}>
            Telegram и MAX — внешние чаты поддержки (откроются в браузере или приложении).
          </div>
        </div>

        <div className="mobileCard" style={{ marginTop: 8 }}>
          <BrowserNotificationsCard
            title="Push-уведомления браузера"
            description="Системные уведомления для realtime-событий, пока приложение открыто."
          />
        </div>

        {/* Specializations */}
        <div className="mobileCard" style={{ marginTop: 8 }}>
          <div className="mobileProfileSectionLabel">Мои специализации</div>
          <div className="mobileFieldHint">Специализации будут доступны позже.</div>
        </div>

        {/* App info */}
        <div className="mobileCard" style={{ marginTop: 8 }}>
          <div className="mobileProfileSectionLabel">О приложении</div>
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
    </>
  )
}
