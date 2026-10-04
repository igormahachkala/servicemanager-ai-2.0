import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../lib/api'
import { MaterialDictionaryPanel } from '../components/materials/MaterialsPanels'

export function MaterialsPage() {
  const qc = useQueryClient()
  const materialsQ = useQuery({ queryKey: ['materials-directory'], queryFn: api.materials })

  const createM = useMutation({
    mutationFn: api.createMaterial,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })

  const statusM = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setMaterialStatus(id, active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })
  const updateM = useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.UpdateMaterialInput }) => api.updateMaterial(id, input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['materials-directory'] })
    },
  })

  return (
    <div>
      <div className="row">
        <div>
          <h2 style={{ marginBottom: 4 }}>Материалы</h2>
          <div className="muted small">
            {materialsQ.isFetching ? 'Загрузка…' : materialsQ.data?.length ? `Всего материалов: ${materialsQ.data.length}` : 'Справочник пуст'}
          </div>
        </div>
        <div>
          <Link to="/settings">
            <button className="ghost">← К настройкам</button>
          </Link>
        </div>
      </div>

      <div className="pageHint">
        Минимальный справочник для остатков техников и списания материалов в заявках. Складской учёт, закупки и аналитика не входят в V0.
      </div>

      {materialsQ.isError ? <div className="alert">{(materialsQ.error as any)?.message || String(materialsQ.error)}</div> : null}
      {createM.isError ? <div className="alert">{(createM.error as any)?.message || String(createM.error)}</div> : null}
      {statusM.isError ? <div className="alert">{(statusM.error as any)?.message || String(statusM.error)}</div> : null}
      {updateM.isError ? <div className="alert">{(updateM.error as any)?.message || String(updateM.error)}</div> : null}

      <MaterialDictionaryPanel
        materials={materialsQ.data || []}
        loading={materialsQ.isFetching}
        submitting={createM.isPending || statusM.isPending || updateM.isPending}
        onCreate={(input) => createM.mutate(input)}
        onUpdate={(id, input) => updateM.mutate({ id, input })}
        onToggleActive={(id, active) => statusM.mutate({ id, active })}
      />
    </div>
  )
}
