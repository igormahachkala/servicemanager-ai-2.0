import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { groupInspectionItemsByZone, responseTypeLabel } from '../lib/inspectionZones'
import { mobilePath } from './mobileRoute'
import { useOfflineStatus } from './offline/useOffline'

const LINKED_CLIENT_DIRECTORY_ROLES = new Set<api.Role>([
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
])

type ClientOption = {
  id: string
  name: string
  locations?: api.LocationListItem[]
}

function startErrorMessage(error: unknown): string {
  if (error instanceof api.ApiRequestError && error.status === 403) {
    return 'Начать обход в выбранном контуре нельзя. Проверьте доступ к локации.'
  }
  if (error instanceof api.ApiRequestError && error.status === 404) {
    return 'Шаблон или локация больше недоступны. Обновите выбор и повторите.'
  }
  return 'Не удалось начать обход. Проверьте соединение и повторите.'
}

function checkpointCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} пункт`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} пункта`
  return `${count} пунктов`
}

export function MobileInspectionStartPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const offline = useOfflineStatus()
  const [templateId, setTemplateId] = useState('')
  const [clientCompanyId, setClientCompanyId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const templatesQ = useQuery({
    queryKey: ['inspection-templates'],
    queryFn: api.getInspectionTemplates,
  })
  const isTechnician = meQ.data?.role === 'TECHNICIAN'
  const canReadLinkedClients = !!meQ.data && LINKED_CLIENT_DIRECTORY_ROLES.has(meQ.data.role)

  const technicianContextsQ = useQuery({
    queryKey: ['inspection-start-technician-contexts'],
    queryFn: () => api.getTechnicianBoundContexts(),
    enabled: isTechnician,
  })
  const linkedClientsQ = useQuery({
    queryKey: ['inspection-start-linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: canReadLinkedClients,
  })

  const clientOptions = useMemo<ClientOption[]>(() => {
    if (isTechnician) {
      return (technicianContextsQ.data || []).map((context) => ({
        id: context.clientCompany.id,
        name: context.clientCompany.name,
        locations: context.locations,
      }))
    }
    return (linkedClientsQ.data || []).map((contract) => ({
      id: contract.clientCompany.id,
      name: contract.clientCompany.name,
    }))
  }, [isTechnician, linkedClientsQ.data, technicianContextsQ.data])

  const isProviderContext = isTechnician || clientOptions.length > 0
  const selectedClient = clientOptions.find((item) => item.id === clientCompanyId) || null

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const hintedId = (params.get('linkedClientCompanyId') || api.getLinkedClientCompanyId(meQ.data)).trim()
    const validHint = clientOptions.some((item) => item.id === hintedId) ? hintedId : ''
    const onlyOption = clientOptions.length === 1 ? clientOptions[0].id : ''
    const next = validHint || onlyOption
    setClientCompanyId((current) => (clientOptions.some((item) => item.id === current) ? current : next))
  }, [clientOptions, location.search, meQ.data])

  useEffect(() => {
    const templates = (templatesQ.data || []).filter((template) => template.isActive !== false)
    setTemplateId((current) => {
      if (templates.some((template) => template.id === current)) return current
      return templates.length === 1 ? templates[0].id : ''
    })
  }, [templatesQ.data])

  useEffect(() => {
    setLocationId('')
  }, [clientCompanyId])

  const canLoadLocations = !!meQ.data && !isTechnician && (!isProviderContext || !!clientCompanyId)
  const locationsQ = useQuery({
    queryKey: ['inspection-start-locations', clientCompanyId || 'own'],
    queryFn: () => api.locations(clientCompanyId || undefined),
    enabled: canLoadLocations,
  })

  const activeTemplates = useMemo(
    () => (templatesQ.data || []).filter((template) => template.isActive !== false),
    [templatesQ.data],
  )
  const activeLocations = useMemo(
    () => (isTechnician ? selectedClient?.locations || [] : locationsQ.data || []).filter((item) => item.isActive !== false),
    [isTechnician, locationsQ.data, selectedClient],
  )

  useEffect(() => {
    setLocationId((current) => {
      if (activeLocations.some((item) => item.id === current)) return current
      return activeLocations.length === 1 ? activeLocations[0].id : ''
    })
  }, [activeLocations])

  const selectedTemplate = activeTemplates.find((template) => template.id === templateId) || null
  const selectedTemplateZones = selectedTemplate ? groupInspectionItemsByZone(selectedTemplate.items) : []

  const startRunM = useMutation({
    mutationFn: api.startInspectionRun,
    onSuccess: async (run) => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      queryClient.setQueryData(['inspection-run', run.id], run)

      const params = new URLSearchParams(location.search)
      if (isProviderContext && clientCompanyId) {
        params.delete('companyId')
        params.set('linkedClientCompanyId', clientCompanyId)
      }
      const destination = mobilePath(location.pathname, `/inspection/${run.id}`)
      navigate(`${destination}${params.toString() ? `?${params.toString()}` : ''}`)
    },
    onError: (cause: unknown) => setError(startErrorMessage(cause)),
  })

  function startRun() {
    if (!offline.online) return setError('Начать новый обход можно только онлайн. Уже начатые обходы доступны офлайн.')
    if (!templateId) return setError('Выберите тип обхода')
    if (isProviderContext && !clientCompanyId) return setError('Выберите клиентский контур')
    if (!locationId) return setError('Выберите локацию')
    setError(null)
    startRunM.mutate({ templateId, locationId })
  }

  const contextLoading = isTechnician ? technicianContextsQ.isLoading : canReadLinkedClients && linkedClientsQ.isLoading
  const contextError = isTechnician ? technicianContextsQ.isError : linkedClientsQ.isError
  const loading = meQ.isLoading || templatesQ.isLoading || contextLoading
  const loadFailed = meQ.isError || templatesQ.isError || contextError
  const locationsLoading = !isTechnician && locationsQ.isLoading
  const backHref = `${mobilePath(location.pathname, '/inspection')}${location.search}`
  const startDisabled =
    !offline.online ||
    startRunM.isPending ||
    !templateId ||
    !locationId ||
    (isProviderContext && !clientCompanyId)

  return (
    <div className="mobileSection mobileInspectionStart">
      <div className="mobileTicketDetailsToolbar">
        <Link to={backHref} className="mobileDetailsBackLink mobilePatrolBackLink">
          <span aria-hidden>‹</span>
          Обходы
        </Link>
      </div>

      <div>
        <h1 className="mobileTitle">Начать обход</h1>
        <div className="mobileSubtitle">Выберите тип обхода и доступную локацию</div>
      </div>

      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      {!offline.online ? (
        <div className="mobileNotice mobileNoticeWarn">
          Начать новый обход можно только онлайн. Уже начатые обходы доступны офлайн.
        </div>
      ) : null}
      {loading ? <div className="mobileCard mobileMeta">Загружаем доступные варианты…</div> : null}
      {loadFailed ? (
        <div className="mobileNotice mobileNoticeError">Не удалось загрузить данные для обхода. Обновите страницу и повторите.</div>
      ) : null}

      {!loading && !loadFailed ? (
        <>
          <fieldset className="mobileInspectionStartGroup">
            <legend>Тип обхода</legend>
            {activeTemplates.length === 0 ? (
              <div className="mobileCard mobileEmptyState" role="status">
                <div className="mobileEmptyStateTitle">Нет доступных типов обхода</div>
                <p className="mobileEmptyStateHint">Обратитесь к администратору, чтобы добавить активный шаблон.</p>
              </div>
            ) : (
              <div className="mobileInspectionTemplateChoices">
                {activeTemplates.map((template) => {
                  const selected = template.id === templateId
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className={`mobileInspectionTemplateChoice${selected ? ' mobileInspectionTemplateChoice--selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setTemplateId(template.id)}
                    >
                      <strong>{template.name}</strong>
                      {template.description ? <span>{template.description}</span> : null}
                      <span>{checkpointCountLabel(template.items.length)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>

          {clientOptions.length > 1 ? (
            <label className="mobileInspectionStartField">
              <span>Клиентский контур</span>
              <select value={clientCompanyId} onChange={(event) => setClientCompanyId(event.target.value)}>
                <option value="">Выберите клиента</option>
                {clientOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          ) : clientOptions.length === 1 ? (
            <div className="mobileCard mobileInspectionCurrentContext">
              <span>Клиентский контур</span>
              <strong>{clientOptions[0].name}</strong>
            </div>
          ) : isProviderContext ? (
            <div className="mobileCard mobileEmptyState" role="status">
              <div className="mobileEmptyStateTitle">Нет доступных клиентских контуров</div>
            </div>
          ) : null}

          <label className="mobileInspectionStartField">
            <span>Локация</span>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              disabled={(isProviderContext && !clientCompanyId) || locationsLoading}
            >
              <option value="">
                {isProviderContext && !clientCompanyId
                  ? 'Сначала выберите клиента'
                  : locationsLoading
                    ? 'Загружаем локации…'
                    : 'Выберите локацию'}
              </option>
              {activeLocations.map((item) => (
                <option key={item.id} value={item.id}>{item.name}{item.city ? ` · ${item.city}` : ''}</option>
              ))}
            </select>
          </label>

          {!isTechnician && locationsQ.isError ? (
            <div className="mobileNotice mobileNoticeError">Не удалось загрузить доступные локации.</div>
          ) : null}
          {((isTechnician && !!clientCompanyId) || locationsQ.isSuccess) && activeLocations.length === 0 ? (
            <div className="mobileCard mobileEmptyState" role="status">
              <div className="mobileEmptyStateTitle">Нет доступных локаций</div>
              <p className="mobileEmptyStateHint">Для выбранного контура нет локаций, доступных для обхода.</p>
            </div>
          ) : null}

          {selectedTemplate ? (
            <div className="mobileCard mobileInspectionStartPreview">
              <strong>Что будет проверено</strong>
              {selectedTemplateZones.map((zone) => (
                <div key={zone.key} className="mobileInspectionStartZoneGroup">
                  <div className="mobileInspectionStartZone">{zone.name}</div>
                  <ul>
                    {zone.items.map((item) => (
                      <li key={item.id}>
                        <span>{item.title}</span>
                        <small>{responseTypeLabel(item.responseType)}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="mobileBtn mobileInspectionStartSubmit"
            disabled={startDisabled}
            onClick={startRun}
          >
            {startRunM.isPending ? 'Начинаем обход…' : 'Начать обход'}
          </button>
        </>
      ) : null}
    </div>
  )
}
