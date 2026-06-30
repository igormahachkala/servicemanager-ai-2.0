import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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

function isProviderLinkedClientRole(role?: api.Role | null) {
  return (
    role === 'ADMIN' ||
    role === 'ADMIN_PROVIDER' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'NETWORK_DIRECTOR'
  )
}

export function MobileProfile() {
  const location = useLocation()
  const navigate = useNavigate()
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

  const companyQ = useQuery({
    queryKey: ['mobile-shell-company'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'CLIENT' && meQ.data.role !== 'TECHNICIAN',
  })

  const linkedClientCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const observerCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const isProviderCompany = companyQ.data?.type === 'PROVIDER'
  const canShowLinkedClients = !!meQ.data && isProviderCompany && isProviderLinkedClientRole(meQ.data.role)
  const linkedClientsLoaded = !canShowLinkedClients || linkedClientsQ.isSuccess || linkedClientsQ.isError
  const selectedLinkedClient = useMemo(
    () => linkedClientsQ.data?.find((row) => row.clientCompany.id === linkedClientCompanyId) || null,
    [linkedClientsQ.data, linkedClientCompanyId],
  )

  function updateProviderScope(nextLinkedClientCompanyId: string) {
    const params = new URLSearchParams(location.search)
    params.delete('companyId')
    if (nextLinkedClientCompanyId.trim()) {
      params.set('linkedClientCompanyId', nextLinkedClientCompanyId.trim())
    } else {
      params.delete('linkedClientCompanyId')
    }
    api.persistScopeFromSearchParams(params, meQ.data)
    const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    if (next !== `${location.pathname}${location.search}`) {
      navigate(next, { replace: true })
    }
  }

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

  // Полный список клиентских компаний техника (без scope-фильтра) — для переключателя контура.
  // bound-contexts сортируются по имени (name asc) на бэке; [0] — лишь дефолт, выбор персистится.
  const techBoundContextsAllQ = useQuery({
    queryKey: ['mobile-profile-technician-bound-all', meQ.data?.id],
    queryFn: () => api.getTechnicianBoundContexts(),
    enabled: !!meQ.data && meQ.data.role === 'TECHNICIAN',
  })
  const techBoundContexts = techBoundContextsAllQ.data || []
  const techCanSwitchCompany = meQ.data?.role === 'TECHNICIAN' && techBoundContexts.length >= 2

  // Галочка «контур по умолчанию» — переиспользует тот же персист (LAST_SCOPE_KEY).
  // Отмечена → выбранная компания запоминается дефолтом (persisted > [0]); снята → clear → авто-[0].
  const [techRememberDefault, setTechRememberDefault] = useState(false)
  useEffect(() => {
    if (meQ.data?.role !== 'TECHNICIAN') return
    setTechRememberDefault(!!api.getPersistedLinkedClientCompanyId(meQ.data))
  }, [meQ.data, linkedClientCompanyId])
  function toggleTechDefaultContour(checked: boolean) {
    setTechRememberDefault(checked)
    if (checked) {
      if (linkedClientCompanyId) {
        api.persistScopeFromSearchParams(new URLSearchParams({ linkedClientCompanyId }), meQ.data)
      }
    } else {
      api.clearPersistedScope()
    }
  }

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

        {/* Client context */}
        {canShowLinkedClients ? (
          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Клиентский контур</div>
            {linkedClientsLoaded ? (
              linkedClientsQ.data && linkedClientsQ.data.length > 0 ? (
                <>
                  <select
                    className="mobileProviderContextSelect"
                    value={linkedClientCompanyId}
                    onChange={(e) => updateProviderScope(e.target.value)}
                  >
                    <option value="">Выберите клиента</option>
                    {linkedClientsQ.data.map((item) => (
                      <option key={item.clientCompany.id} value={item.clientCompany.id}>
                        {item.clientCompany.name} · {item.role}
                      </option>
                    ))}
                  </select>
                  <div className="mobileProviderContextHint" style={{ marginTop: 6 }}>
                    Контекст применяется к доске, созданию заявки и карточкам заявок.
                  </div>
                  {selectedLinkedClient ? (
                    <div className="mobileProviderContextHint">Роль: {selectedLinkedClient.role}</div>
                  ) : null}
                </>
              ) : (
                <div className="mobileProviderContextHint">У этой компании пока нет связанных клиентов.</div>
              )
            ) : (
              <div className="mobileProviderContextHint">Загружаем список клиентов…</div>
            )}
            {linkedClientsQ.isError ? (
              <div className="mobileNotice mobileNoticeError" style={{ marginTop: 8 }}>
                {(linkedClientsQ.error as any)?.message || String(linkedClientsQ.error)}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Client context switcher for TECHNICIAN — источник: bound-contexts (полный список) */}
        {techCanSwitchCompany ? (
          <div className="mobileCard" style={{ marginTop: 8 }}>
            <div className="mobileSectionTitle" style={{ marginBottom: 8 }}>Клиентская компания</div>
            <select
              className="mobileProviderContextSelect"
              value={linkedClientCompanyId}
              onChange={(e) => updateProviderScope(e.target.value)}
            >
              {techBoundContexts.map((ctx) => (
                <option key={ctx.clientCompany.id} value={ctx.clientCompany.id}>
                  {ctx.clientCompany.name}
                </option>
              ))}
            </select>
            <div className="mobileProviderContextHint" style={{ marginTop: 6 }}>
              Контекст применяется к главной, моим заявкам и созданию заявки.
            </div>
            <label className="mobileProviderContextDefault" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="checkbox"
                checked={techRememberDefault}
                onChange={(e) => toggleTechDefaultContour(e.target.checked)}
              />
              <span>Запомнить как контур по умолчанию</span>
            </label>
          </div>
        ) : null}

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
    </>
  )
}
