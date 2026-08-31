import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserNotificationsCard } from '../components/BrowserNotificationsCard'
import { SupportContactBlock } from '../components/SupportContactBlock'
import * as api from '../lib/api'
import { startMobileGuidedTour } from './MobileGuidedTourEvents'
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

  const appContour = useMemo(() => {
    if (typeof window === 'undefined') return '—'
    const h = window.location.hostname
    if (h.includes('194.67.101.37') || h.includes('stage')) return 'Stage'
    if (h.includes('servicemanagerai.ru')) return 'Production'
    if (h === 'localhost' || h === '127.0.0.1') return 'Локально'
    return h || '—'
  }, [])
  const currentScope = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const linked = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const observer = (params.get('companyId') || api.getObserverCompanyId(meQ.data)).trim()
    return {
      linkedClientCompanyId: linked || undefined,
      companyId: observer || undefined,
    }
  }, [location.search, meQ.data])

  function logout() {
    const params = new URLSearchParams()
    params.set('next', mobilePath(location.pathname, ''))
    params.set('mode', 'mobile')
    if (currentScope.linkedClientCompanyId) params.set('linkedClientCompanyId', currentScope.linkedClientCompanyId)
    if (currentScope.companyId) params.set('companyId', currentScope.companyId)

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
    currentScope,
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
            {meQ.data?.phone ? <div className="mobileProfileCompany">{meQ.data.phone}</div> : null}
          </div>
        </div>

        <div className="mobileCard">
          <div className="mobileProfileSectionLabel">Личные данные</div>
          <div className="mobileProfileInfoRow">
            <span className="mobileMeta">Email</span>
            <span>{meQ.data?.email || '—'}</span>
          </div>
          <div className="mobileProfileInfoRow">
            <span className="mobileMeta">Телефон</span>
            <span>{meQ.data?.phone || '—'}</span>
          </div>
          <div className="mobileProfileInfoRow">
            <span className="mobileMeta">Роль</span>
            <span>{roleLabel(meQ.data?.role)}</span>
          </div>
          <div className="mobileProfileInfoRow">
            <span className="mobileMeta">Компания</span>
            <span>{meQ.data?.companyName || '—'}</span>
          </div>
        </div>

        {/* Menu */}
        <div className="mobileCard mobileProfileMenu">
          {meQ.data?.role && ['ADMIN', 'MASTER', 'DISPATCHER', 'TECHNICIAN'].includes(meQ.data.role) ? (
            <Link to={mobilePath(location.pathname, '/shift')} className="mobileProfileMenuItem">
              <span className="mobileProfileMenuIcon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <span className="mobileProfileMenuLabel">Рабочая смена</span>
              <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
            </Link>
          ) : null}
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
          <div className="mobileProfileMenuItem mobileProfileMenuItem--static" aria-disabled="true">
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler lock */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">
              Пароль
              <span className="mobileFieldHint" style={{ display: 'block', margin: 0, fontWeight: 400 }}>Изменение пароля будет доступно позже</span>
            </span>
            <span className="mobileProfileMenuSoon">Скоро</span>
          </div>
          <button type="button" className="mobileProfileMenuItem" onClick={startMobileGuidedTour}>
            <span className="mobileProfileMenuIcon" aria-hidden>
              {/* Tabler route */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="2" />
                <circle cx="18" cy="18" r="2" />
                <path d="M8 6h5a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h5" />
              </svg>
            </span>
            <span className="mobileProfileMenuLabel">Быстрый старт</span>
            <span className="mobileProfileMenuChevron" aria-hidden><ChevronRight /></span>
          </button>
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
