import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import {
  activeMaterials,
  formatMaterialQuantity,
  materialName,
  materialUnit,
  movementTypeLabel,
  normalizeDecimalInput,
  validateIssueInput,
} from '../../lib/materials'

export function TechnicianMaterials(props: { technicianId: string; canIssue: boolean }) {
  const { technicianId, canIssue } = props
  const qc = useQueryClient()
  const balancesQ = useQuery({
    queryKey: ['technician-material-balances', technicianId],
    queryFn: () => api.technicianMaterialBalances(technicianId),
    enabled: !!technicianId,
  })
  const movementsQ = useQuery({
    queryKey: ['technician-material-movements', technicianId],
    queryFn: () => api.technicianMaterialMovements(technicianId),
    enabled: !!technicianId,
  })

  return (
    <div className="materialsSection">
      <h3 style={{ marginBottom: 10 }}>Материалы</h3>
      {balancesQ.isError ? <div className="alert">{(balancesQ.error as Error).message}</div> : null}
      {balancesQ.isLoading ? <div className="muted small">Загрузка остатков…</div> : null}
      {!balancesQ.isLoading && !balancesQ.data?.length ? <div className="muted small">Остатков пока нет</div> : null}
      {balancesQ.data?.length ? (
        <div className="materialsList">
          {balancesQ.data.map((balance) => (
            <div className="materialsRow" key={balance.id}>
              <div className="materialsName">{materialName(balance.material)}</div>
              <div className="materialsQty">{formatMaterialQuantity(balance.quantity, materialUnit(balance.material))}</div>
            </div>
          ))}
        </div>
      ) : null}

      {canIssue ? <IssueMaterialForm technicianId={technicianId} /> : null}

      <h4 style={{ margin: '14px 0 8px' }}>История</h4>
      {movementsQ.isError ? <div className="alert">{(movementsQ.error as Error).message}</div> : null}
      {movementsQ.isLoading ? <div className="muted small">Загрузка истории…</div> : null}
      {!movementsQ.isLoading && !movementsQ.data?.length ? <div className="muted small">Движений пока нет</div> : null}
      {movementsQ.data?.length ? (
        <div className="materialsHistory">
          {movementsQ.data.map((movement) => (
            <div className="materialsHistoryRow" key={movement.id}>
              <div>
                <div className="materialsName">{materialName(movement.material)}</div>
                <div className="muted small">{movementTypeLabel(movement.type)}</div>
                {movement.comment ? <div className="muted small">{movement.comment}</div> : null}
              </div>
              <div className="materialsQty">{formatMaterialQuantity(movement.quantity, materialUnit(movement.material))}</div>
            </div>
          ))}
        </div>
      ) : null}

      <button
        className="ghost"
        onClick={() => Promise.all([
          qc.invalidateQueries({ queryKey: ['technician-material-balances', technicianId] }),
          qc.invalidateQueries({ queryKey: ['technician-material-movements', technicianId] }),
        ])}
        disabled={balancesQ.isFetching || movementsQ.isFetching}
        style={{ marginTop: 10 }}
      >
        Обновить
      </button>
    </div>
  )
}

function IssueMaterialForm({ technicianId }: { technicianId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const materialsQ = useQuery({ queryKey: ['materials-directory'], queryFn: api.materials, enabled: open })
  const options = useMemo(() => activeMaterials(materialsQ.data || []), [materialsQ.data])
  const issueM = useMutation({
    mutationFn: api.issueMaterialToTechnician,
    onSuccess: async (result) => {
      setMessage(`Материал выдан. Остаток склада: ${formatMaterialQuantity(result.stock.quantity)}`)
      setMaterialId('')
      setQuantity('')
      setComment('')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['technician-material-balances', technicianId] }),
        qc.invalidateQueries({ queryKey: ['technician-material-movements', technicianId] }),
      ])
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizeDecimalInput(quantity) ?? quantity.trim()
    const validation = validateIssueInput({ materialId, quantity: normalized })
    if (!validation.ok) {
      setMessage(validation.error)
      return
    }
    setMessage(null)
    issueM.mutate({
      technicianId,
      materialId,
      quantity: normalized,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    })
  }

  if (!open) return <button className="ghost" onClick={() => setOpen(true)} style={{ marginTop: 10 }}>+ Выдать материал</button>

  return (
    <form className="materialsForm panel" onSubmit={submit} style={{ marginTop: 10 }}>
      <h4>Выдать материал</h4>
      {message ? <div className="muted small">{message}</div> : null}
      {issueM.isError ? <div className="alert">{(issueM.error as Error).message}</div> : null}
      <label>
        Материал
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={issueM.isPending}>
          <option value="">Выберите материал</option>
          {options.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.unit}</option>)}
        </select>
      </label>
      <label>
        Количество
        <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={issueM.isPending} />
      </label>
      <label>
        Комментарий
        <input value={comment} onChange={(e) => setComment(e.target.value)} disabled={issueM.isPending} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={issueM.isPending}>{issueM.isPending ? 'Выдаём…' : 'Выдать'}</button>
        <button type="button" className="ghost" onClick={() => setOpen(false)} disabled={issueM.isPending}>Отмена</button>
      </div>
    </form>
  )
}

export default TechnicianMaterials
