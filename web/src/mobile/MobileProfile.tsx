import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../lib/api'

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
  const nav = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const linkedClientCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  }, [location.search])

  function logout() {
    api.clearToken()
    queryClient.clear()
    nav('/login', { replace: true })
  }

  return (
    <div className="mobileSection" style={{ minHeight: 'calc(100dvh - 130px)' }}>
      <div>
        <h1 className="mobileTitle">Профиль</h1>
        <div className="mobileSubtitle">Ключевая информация и быстрый выход</div>
      </div>

      {meQ.isError ? <div className="mobileNotice mobileNoticeError">{String((meQ.error as any)?.message || meQ.error)}</div> : null}

      <div className="mobileCard">
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
            <div className="mobileRow">
              <span className="mobileMeta">Текущий linked client</span>
              <strong>{linkedClientCompanyId}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button className="mobileBtn" onClick={logout} style={{ width: '100%' }}>
          Выйти
        </button>
      </div>
    </div>
  )
}
