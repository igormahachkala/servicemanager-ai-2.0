import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

/**
 * Карточка переключения клиентского контура — общая для Профиля и Настроек.
 * Самодостаточна: сама тянет me / company / linked-clients / bound-contexts по тем же
 * queryKey, что и остальные экраны (React Query дедуплицирует по ключу — лишних запросов нет),
 * сама персистит scope через URL + LAST_SCOPE_KEY.
 *
 * Рендерит один из вариантов или null:
 *  – провайдер-роли (ADMIN/MASTER/DISPATCHER/NETWORK_DIRECTOR) → select по linked-clients;
 *  – TECHNICIAN c ≥2 bound-contexts → select по компаниям + чекбокс «контур по умолчанию».
 */
function isProviderLinkedClientRole(role?: api.Role | null) {
  return (
    role === 'ADMIN' ||
    role === 'ADMIN_PROVIDER' ||
    role === 'MASTER' ||
    role === 'DISPATCHER' ||
    role === 'NETWORK_DIRECTOR'
  )
}

export function ClientContourCard() {
  const location = useLocation()
  const navigate = useNavigate()
  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })

  const linkedClientCompanyId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
  }, [location.search, meQ.data])

  const companyQ = useQuery({
    queryKey: ['mobile-shell-company'],
    queryFn: () => api.company(),
    enabled: !!meQ.data && meQ.data.role !== 'CLIENT' && meQ.data.role !== 'TECHNICIAN',
  })

  const linkedClientsQ = useQuery({
    queryKey: ['linked-clients'],
    queryFn: () => api.getLinkedClients(),
    enabled: !!meQ.data && meQ.data.role !== 'TECHNICIAN',
  })

  const techBoundContextsAllQ = useQuery({
    queryKey: ['mobile-profile-technician-bound-all', meQ.data?.id],
    queryFn: () => api.getTechnicianBoundContexts(),
    enabled: !!meQ.data && meQ.data.role === 'TECHNICIAN',
  })
  const techBoundContexts = techBoundContextsAllQ.data || []
  const techCanSwitchCompany = meQ.data?.role === 'TECHNICIAN' && techBoundContexts.length >= 2

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

  // Галочка «контур по умолчанию» — тот же персист (LAST_SCOPE_KEY): отмечена → запоминаем выбор,
  // снята → clear → авто-[0].
  const [techRememberDefault, setTechRememberDefault] = useState(false)
  useEffect(() => {
    if (meQ.data?.role !== 'TECHNICIAN') return
    // Синхронизация с внешним источником (localStorage/LAST_SCOPE_KEY) при загрузке me/смене контура.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  if (canShowLinkedClients) {
    return (
      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileProfileSectionLabel">Клиентский контур</div>
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
            {(linkedClientsQ.error as { message?: string } | null)?.message || String(linkedClientsQ.error)}
          </div>
        ) : null}
      </div>
    )
  }

  if (techCanSwitchCompany) {
    return (
      <div className="mobileCard" style={{ marginTop: 8 }}>
        <div className="mobileProfileSectionLabel">Клиентская компания</div>
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
          <input type="checkbox" checked={techRememberDefault} onChange={(e) => toggleTechDefaultContour(e.target.checked)} />
          <span>Запомнить как контур по умолчанию</span>
        </label>
      </div>
    )
  }

  return null
}
