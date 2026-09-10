import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { groupInspectionItemsByZone } from '../lib/inspectionZones'
import { ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE, isActiveShiftRequiredError } from './mobileShiftGate'
import { mobilePath } from './mobileRoute'

const LINKED_CLIENT_DIRECTORY_ROLES = new Set<api.Role>([
  'ADMIN',
  'MASTER',
  'DISPATCHER',
  'NETWORK_DIRECTOR',
])

function startErrorMessage(error: unknown): string {
  if (isActiveShiftRequiredError(error)) return ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE
  if (error instanceof api.ApiRequestError && error.status === 403) {
    return 'Начать обход в выбранном контуре нельзя. Проверьте доступ и рабочую смену.'
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
  const [templateId, setTemplateId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const templatesQ = useQuery({
    queryKey: ['inspection-templates'],
    queryFn: api.getInspectionTemplates,
  })

  const canReadLinkedClientDirectory = !!meQ.data && LINKED_CLIENT_DIRECTORY_ROLES.has(meQ.data.role)
  const linkedClientsQ = useQuery({
    queryKey: ['inspection-linked-clients'],
    queryFn: api.getLinkedClients,
    enabled: canReadLinkedClientDirectory,
  })
  const linkedClients = useMemo(() => linkedClientsQ.data || [], [linkedClientsQ.data])

  const currentLinkedClientId = useMemo(() => {
    const search = new URLSearchParams(location.search)
    return (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyIdFromMe(meQ.data)).trim()
  }, [location.search, meQ.data])

  const usesFixedTechnicianContext = meQ.data?.role === 'TECHNICIAN'
  const isProviderScope = linkedClients.length > 0 || usesFixedTechnicianContext

  useEffect(() => {
    if (!meQ.data) return
    if (usesFixedTechnicianContext) {
      if (selectedClientId !== currentLinkedClientId) setSelectedClientId(currentLinkedClientId)
      return
    }
    if (linkedClients.length === 0) {
      if (selectedClientId) setSelectedClientId('')
      return
    }
    if (selectedClientId && linkedClients.some((row) => row.clientCompany.id === selectedClientId)) return
    const fromUrl = linkedClients.some((row) => row.clientCompany.id === currentLinkedClientId)
      ? currentLinkedClientId
      : ''
    const onlyClient = linkedClients.length === 1 ? linkedClients[0].clientCompany.id : ''
    setSelectedClientId(fromUrl || onlyClient)
  }, [currentLinkedClientId, linkedClients, meQ.data, selectedClientId, usesFixedTechnicianContext])

  useEffect(() => {
    setLocationId('')
  }, [selectedClientId])

  const linkedDirectoryReady = !canReadLinkedClientDirectory || linkedClientsQ.isSuccess
  const scopeCompanyId = isProviderScope ? selectedClientId : ''
  const canLoadLocations =
    !!meQ.data &&
    linkedDirectoryReady &&
    (!isProviderScope || !!scopeCompanyId)

  const locationsQ = useQuery({
    queryKey: ['inspection-start-locations', scopeCompanyId || 'own'],
    queryFn: () => api.locations(scopeCompanyId || undefined),
    enabled: canLoadLocations,
  })

  const activeTemplates = useMemo(
    () => (templatesQ.data || []).filter((template) => template.isActive !== false),
    [templatesQ.data],
  )
  const activeLocations = useMemo(
    () => (locationsQ.data || []).filter((item) => item.isActive !== false),
    [locationsQ.data],
  )
  const selectedTemplate = activeTemplates.find((template) => template.id === templateId) || null
  const selectedTemplateZones = selectedTemplate ? groupInspectionItemsByZone(selectedTemplate.items) : []

  const startRunM = useMutation({
    mutationFn: api.startInspectionRun,
    onSuccess: async (run) => {
      setError(null)
      await queryClient.invalidateQueries({ queryKey: ['inspection-runs'] })
      queryClient.setQueryData(['inspection-run', run.id], run)

      const params = new URLSearchParams(location.search)
      if (isProviderScope && selectedClientId) {
        params.delete('companyId')
        params.set('linkedClientCompanyId', selectedClientId)
      }
      const destination = mobilePath(location.pathname, `/inspection/${run.id}`)
      navigate(`${destination}${params.toString() ? `?${params.toString()}` : ''}`)
    },
    onError: (cause: unknown) => setError(startErrorMessage(cause)),
  })

  function startRun() {
    if (!templateId) {
      setError('Выберите тип обхода')
      return
    }
    if (isProviderScope && !selectedClientId) {
      setError('Выберите клиентский контур')
      return
    }
    if (!locationId) {
      setError('Выберите локацию')
      return
    }
    setError(null)
    startRunM.mutate({ templateId, locationId })
  }

  const backHref = `${mobilePath(location.pathname, '/inspection')}${location.search}`
  const loading = meQ.isLoading || templatesQ.isLoading || (canReadLinkedClientDirectory && linkedClientsQ.isLoading)
  const loadFailed = meQ.isError || templatesQ.isError || linkedClientsQ.isError
  const technicianContextMissing = usesFixedTechnicianContext && !selectedClientId

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
      {loading ? <div className="mobileCard mobileMeta">Загружаем доступные варианты…</div> : null}
      {loadFailed ? (
        <div className="mobileNotice mobileNoticeError">
          Не удалось загрузить данные для обхода. Обновите страницу и повторите.
        </div>
      ) : null}
      {technicianContextMissing ? (
        <div className="mobileNotice mobileNoticeError">
          Сначала выберите клиентский контур в рабочем пространстве.
        </div>
      ) : null}

      {!loading && !loadFailed ? (
        <>
          <fieldset className="mobileInspectionStartGroup">
            <legend>Тип обхода</legend>
            {activeTemplates.length === 0 ? (
              <div className="mobileEmptyState" role="status">
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
                      <span className="mobileInspectionTemplateChoiceTitle">{template.name}</span>
                      {template.description ? <span>{template.description}</span> : null}
                      <span>{checkpointCountLabel(template.items.length)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </fieldset>

          {linkedClients.length > 0 ? (
            <label className="mobileInspectionStartField">
              <span>Клиент</span>
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                <option value="">Выберите клиента</option>
                {linkedClients.map((row) => (
                  <option key={row.clientCompany.id} value={row.clientCompany.id}>{row.clientCompany.name}</option>
                ))}
              </select>
            </label>
          ) : usesFixedTechnicianContext && selectedClientId ? (
            <div className="mobileCard mobileInspectionCurrentContext">
              <span>Клиентский контур</span>
              <strong>Текущий рабочий контур</strong>
            </div>
          ) : null}

          <label className="mobileInspectionStartField">
            <span>Локация</span>
            <select
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
              disabled={!canLoadLocations || locationsQ.isLoading}
            >
              <option value="">
                {!canLoadLocations ? 'Сначала выберите клиента' : locationsQ.isLoading ? 'Загружаем локации…' : 'Выберите локацию'}
              </option>
              {activeLocations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.city ? ` · ${item.city}` : ''}
                </option>
              ))}
            </select>
          </label>

          {locationsQ.isError ? (
            <div className="mobileNotice mobileNoticeError">Не удалось загрузить доступные локации.</div>
          ) : null}
          {canLoadLocations && locationsQ.isSuccess && activeLocations.length === 0 ? (
            <div className="mobileCard mobileEmptyState" role="status">
              <div className="mobileEmptyStateTitle">Нет доступных локаций</div>
              <p className="mobileEmptyStateHint">Для выбранного контура нет локаций, доступных для обхода.</p>
            </div>
          ) : null}

          {selectedTemplate ? (
            <div className="mobileCard mobileInspectionStartPreview">
              <strong>Что будет в обходе</strong>
              {selectedTemplateZones.map((zone) => (
                <div key={zone.key}>
                  <div className="mobileInspectionStartZone">{zone.name}</div>
                  <div className="mobileMeta">{checkpointCountLabel(zone.items.length)}</div>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="mobileBtn mobileInspectionStartSubmit"
            disabled={startRunM.isPending || !templateId || !locationId || technicianContextMissing}
            onClick={startRun}
          >
            {startRunM.isPending ? 'Начинаем обход…' : 'Начать обход'}
          </button>
        </>
      ) : null}
    </div>
  )
}
