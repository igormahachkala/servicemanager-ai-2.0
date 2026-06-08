import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BrowserNotificationsCard } from '../components/BrowserNotificationsCard'
import { SupportContactBlock } from '../components/SupportContactBlock'
import * as api from '../lib/api'
import { canAccessManagementDesktop } from '../lib/navigation'
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

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Профиль</h1>
        <div className="mobileSubtitle">Ключевая информация и выход из аккаунта</div>
      </div>

      {meQ.isError ? <div className="mobileNotice mobileNoticeError">{String((meQ.error as any)?.message || meQ.error)}</div> : null}

      <div className="mobileCard">
        <BrowserNotificationsCard
          className="mobileSection"
          title="Браузерные уведомления"
          description="Системные уведомления для realtime-событий, пока приложение открыто."
        />

        <div className="mobileSection" style={{ gap: 8 }}>
          <div className="mobileRow">
            <span className="mobileMeta">Пользователь</span>
            <strong>
              {[meQ.data?.firstName, meQ.data?.lastName].filter(Boolean).join(' ') || meQ.data?.email || '—'}
            </strong>
          </div>
          <div className="mobileRow">
            <span className="mobileMeta">Email</span>
            <strong>{meQ.data?.email || '—'}</strong>
          </div>
          <div className="mobileRow">
            <span className="mobileMeta">Компания</span>
            <strong>{meQ.data?.companyName || '—'}</strong>
          </div>
          <div className="mobileRow">
            <span className="mobileMeta">Роль</span>
            <strong>{roleLabel(meQ.data?.role)}</strong>
          </div>
          {linkedClientCompanyId ? (
            <div style={{ display: 'grid', gap: 4 }}>
              <div className="mobileMeta">Текущий клиент</div>
              <div>
                <strong>
                  {(meQ.data?.role === 'TECHNICIAN' ? techBoundLabelQ.isLoading : linkedClientsQ.isLoading)
                    ? 'Загрузка…'
                    : linkedClientName || '—'}
                </strong>
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'grid',
            gap: 12,
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid #e5e7eb',
            width: '100%',
          }}
        >
          <div className="mobileFieldHint" style={{ marginBottom: 4 }}>
            Telegram и MAX — внешние чаты поддержки по вопросам системы (откроются в браузере или приложении).
          </div>
          <SupportContactBlock titleTag="div" />
          {canAccessManagementDesktop(meQ.data?.role) ? (
            <Link to={managementHref} className="mobileBtn mobileBtnSecondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              Управленческая часть
            </Link>
          ) : null}
          <button type="button" className="mobileBtn mobileLogoutBelowCard" style={{ marginTop: 0 }} onClick={logout}>
            Выйти
          </button>
        </div>
      </div>
    </div>
  )
}
