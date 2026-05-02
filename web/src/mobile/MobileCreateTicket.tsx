import React, { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as api from '../lib/api'

type CreateResult = {
  ticketId: string
  claimed: boolean
}

export function MobileCreateTicket() {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  const linkedClientCompanyId = (search.get('linkedClientCompanyId') || api.getLinkedClientCompanyId()).trim()
  const companyId = (search.get('companyId') || api.getObserverCompanyId()).trim()
  const scope = {
    linkedClientCompanyId: linkedClientCompanyId || undefined,
    companyId: companyId || undefined,
  }

  const meQ = useQuery({ queryKey: ['me'], queryFn: api.me })
  const locationsQ = useQuery({
    queryKey: ['mobile-create-locations', linkedClientCompanyId, companyId],
    queryFn: () => api.locations(companyId || linkedClientCompanyId || undefined),
    enabled: !!meQ.data,
  })
  const categoriesQ = useQuery({
    queryKey: ['mobile-create-categories', linkedClientCompanyId, companyId],
    queryFn: () => api.problemCategories(companyId || linkedClientCompanyId || undefined),
    enabled: !!meQ.data,
  })

  const locations = useMemo(() => (locationsQ.data || []).filter((item) => item.isActive !== false), [locationsQ.data])
  const categories = useMemo(() => (categoriesQ.data || []).filter((item) => item.isActive !== false), [categoriesQ.data])
  const isTechnician = meQ.data?.role === 'TECHNICIAN'

  const [locationId, setLocationId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CreateResult | null>(null)

  React.useEffect(() => {
    if (!locationId && locations.length > 0) setLocationId(locations[0].id)
  }, [locationId, locations])

  React.useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id)
  }, [categoryId, categories])

  const createM = useMutation({
    mutationFn: async (shouldClaim: boolean) => {
      const created = await api.createTicket(
        {
          locationId,
          categoryId,
          createMode: 'quick',
          description: description.trim() || undefined,
        },
        scope,
      )
      const createdId = api.extractCreatedTicketId(created)
      if (!createdId) throw new Error('Не удалось определить id созданной заявки')
      if (shouldClaim) {
        await api.claim(createdId, scope)
      }
      return { ticketId: createdId, claimed: shouldClaim }
    },
    onSuccess: (created) => {
      setError('')
      setResult(created)
      setDescription('')
    },
    onError: (e: any) => {
      setResult(null)
      setError(e?.message || String(e))
    },
  })

  function onCreate(shouldClaim: boolean) {
    setError('')
    setResult(null)
    if (!locationId || !categoryId) {
      setError('Выберите локацию и категорию')
      return
    }
    createM.mutate(shouldClaim)
  }

  const hasOptions = locations.length > 0 && categories.length > 0

  return (
    <div className="mobileSection">
      <div>
        <h1 className="mobileTitle">Создать заявку</h1>
        <div className="mobileSubtitle">Быстрое создание без desktop-формы</div>
      </div>

      {(locationsQ.isError || categoriesQ.isError) ? (
        <div className="mobileNotice mobileNoticeError">
          {String((locationsQ.error as any)?.message || (categoriesQ.error as any)?.message || 'Не удалось загрузить справочники')}
        </div>
      ) : null}
      {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
      {result ? (
        <div className="mobileNotice mobileNoticeSuccess">
          Заявка создана: `{result.ticketId}`{result.claimed ? ' (взята в работу)' : ''}.
        </div>
      ) : null}

      <div className="mobileCard">
        <form className="mobileForm" onSubmit={(e) => e.preventDefault()}>
          <label>
            Локация
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={locationsQ.isFetching || !locations.length}>
              {locations.length === 0 ? <option value="">Нет доступных локаций</option> : null}
              {locations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Категория
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={categoriesQ.isFetching || !categories.length}>
              {categories.length === 0 ? <option value="">Нет доступных категорий</option> : null}
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Описание
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Коротко опишите проблему"
            />
          </label>

          <button className="mobileBtn" disabled={createM.isPending || !hasOptions} onClick={() => onCreate(false)}>
            {createM.isPending ? 'Создаем...' : 'Создать заявку'}
          </button>
          {isTechnician ? (
            <button className="mobileBtn mobileBtnGhost" disabled={createM.isPending || !hasOptions} onClick={() => onCreate(true)}>
              {createM.isPending ? 'Создаем...' : 'Создать и взять'}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  )
}
