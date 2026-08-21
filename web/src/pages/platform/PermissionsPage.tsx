import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../lib/api'
import { safeGetItem, safeRemoveItem, safeSetItem } from '../../lib/browserStorage'
import { PermissionFilters } from '../../components/permissions/PermissionFilters'
import { PermissionMatrix } from '../../components/permissions/PermissionMatrix'
import { entryKey, type DraftMap, type EntryChange } from '../../components/permissions/permissionDraft'

const DRAFT_LS_KEY = 'sma.permissions.draft.v1'

function MatrixSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="panel uiCard" style={{ display: 'grid', gap: 10 }}>
          <div style={{ height: 18, width: '50%', background: '#eef2ff', borderRadius: 8 }} />
          <div style={{ height: 14, width: '30%', background: '#eef2ff', borderRadius: 8 }} />
          {[0, 1, 2, 3, 4].map((j) => (
            <div key={j} style={{ height: 12, width: '80%', background: '#f1f5f9', borderRadius: 6 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Платформа → Роли и права. Read-only по умолчанию + локальный режим черновика (без записи в БД). */
export function PermissionsPage() {
  const catalogQ = useQuery({ queryKey: ['permissions-catalog'], queryFn: api.fetchPermissionCatalog })
  const matrixQ = useQuery({ queryKey: ['permissions-matrix'], queryFn: api.fetchPermissionMatrix })

  const [roleFilter, setRoleFilter] = useState('')
  const [companyTypeFilter, setCompanyTypeFilter] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<DraftMap>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [applyError, setApplyError] = useState('')
  const queryClient = useQueryClient()

  const matrix = matrixQ.data || []
  const catalog = catalogQ.data || []

  // Исходная матрица из API (источник истины, неизменяемый).
  const originalMap = useMemo<DraftMap>(() => {
    const m: DraftMap = {}
    for (const e of matrix) m[entryKey(e.role, e.companyType)] = [...e.permissions]
    return m
  }, [matrix])

  const roles = useMemo(() => Array.from(new Set(matrix.map((e) => e.role))).sort(), [matrix])
  const companyTypes = useMemo(
    () => Array.from(new Set(matrix.map((e) => (e.companyType === null ? 'ANY' : e.companyType)))).sort(),
    [matrix],
  )

  const filtered = useMemo(
    () =>
      matrix.filter((e) => {
        if (roleFilter && e.role !== roleFilter) return false
        if (companyTypeFilter) {
          const ct = e.companyType === null ? 'ANY' : e.companyType
          if (ct !== companyTypeFilter) return false
        }
        return true
      }),
    [matrix, roleFilter, companyTypeFilter],
  )

  // Diff черновика против исходной матрицы (по всем ролям, не только видимым).
  const changes = useMemo<EntryChange[]>(() => {
    if (!editMode) return []
    const out: EntryChange[] = []
    for (const e of matrix) {
      const k = entryKey(e.role, e.companyType)
      const orig = new Set(originalMap[k] || [])
      const cur = new Set(draft[k] ?? originalMap[k] ?? [])
      const add = [...cur].filter((c) => !orig.has(c)).sort()
      const remove = [...orig].filter((c) => !cur.has(c)).sort()
      if (add.length || remove.length) out.push({ role: e.role, companyType: e.companyType, add, remove })
    }
    return out
  }, [editMode, matrix, originalMap, draft])

  const hasChanges = changes.length > 0

  // Применение дельт на сервер (PATCH). Только по явному подтверждению.
  const applyM = useMutation({
    mutationFn: () =>
      api.applyPermissionChanges(
        changes.map((c) => ({ role: c.role, companyType: c.companyType, add: c.add, remove: c.remove })),
      ),
    onMutate: () => setApplyError(''),
    onSuccess: async () => {
      safeRemoveItem('local', DRAFT_LS_KEY)
      setDraft({})
      setEditMode(false)
      setShowConfirm(false)
      await queryClient.invalidateQueries({ queryKey: ['permissions-matrix'] })
    },
    onError: (e: any) => setApplyError(e?.message || String(e)),
  })

  function enterEdit() {
    // Инициализируем черновик из сохранённого (localStorage) либо из исходной матрицы.
    let initial: DraftMap = { ...originalMap }
    try {
      const raw = safeGetItem('local', DRAFT_LS_KEY, null)
      if (raw) {
        const saved = JSON.parse(raw) as DraftMap
        initial = { ...initial, ...saved }
      }
    } catch {
      /* ignore */
    }
    setDraft(initial)
    setEditMode(true)
  }

  function cancelEdit() {
    setDraft({})
    setEditMode(false)
  }

  function resetToOriginal() {
    setDraft({ ...originalMap })
  }

  function saveDraft() {
    // Сохраняем только изменённые записи (компактно). Запись локальная, без API.
    const payload: DraftMap = {}
    for (const c of changes) payload[entryKey(c.role, c.companyType)] = draft[entryKey(c.role, c.companyType)] || []
    safeSetItem('local', DRAFT_LS_KEY, JSON.stringify(payload))
  }

  function toggle(role: string, companyType: 'CLIENT' | 'PROVIDER' | null, code: string) {
    const k = entryKey(role, companyType)
    setDraft((prev) => {
      const base = prev[k] ?? originalMap[k] ?? []
      const set = new Set(base)
      if (set.has(code)) set.delete(code)
      else set.add(code)
      return { ...prev, [k]: [...set] }
    })
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(changes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'permission-draft.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Безопасность: предупредить о несохранённых изменениях при закрытии вкладки.
  useEffect(() => {
    if (!editMode || !hasChanges) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editMode, hasChanges])

  const isLoading = catalogQ.isLoading || matrixQ.isLoading
  const isError = catalogQ.isError || matrixQ.isError
  const isEmpty = !isLoading && !isError && matrix.length === 0

  return (
    <div className="managementPage">
      <div className="managementPageContext">
      <div className="row" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Роли и права</h2>
          <div className="muted small">Матрица доступа пользователей в платформе Сервис Менеджер</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isLoading && !isError && !isEmpty ? (
            editMode ? (
              <>
                <button className="ghost" onClick={exportJson} disabled={!hasChanges}>Экспорт JSON</button>
                <button className="ghost" onClick={saveDraft} disabled={!hasChanges}>Сохранить черновик</button>
                <button onClick={() => setShowConfirm(true)} disabled={!hasChanges || applyM.isPending}>
                  Применить изменения
                </button>
                <button className="ghost" onClick={cancelEdit}>Отмена</button>
              </>
            ) : (
              <button onClick={enterEdit}>Редактировать</button>
            )
          ) : null}
        </div>
      </div>

      <div className="pageHint">
        {editMode
          ? 'Режим черновика: изменения живут только в браузере и НЕ применяются к системе. Это конструктор будущих изменений.'
          : 'Read-only обзор прав по роли и типу компании. Нажмите «Редактировать», чтобы смоделировать изменения (без применения).'}
      </div>

      {!isLoading && !isError && !isEmpty ? (
        <PermissionFilters
          roles={roles}
          companyTypes={companyTypes}
          roleFilter={roleFilter}
          companyTypeFilter={companyTypeFilter}
          onRoleChange={setRoleFilter}
          onCompanyTypeChange={setCompanyTypeFilter}
        />
      ) : null}
      </div>

      {isError ? (
        <div className="alert">
          Не удалось загрузить права. {String((catalogQ.error as any)?.message || (matrixQ.error as any)?.message || '')}
        </div>
      ) : null}

      {editMode && hasChanges ? (
        <div className="panel" style={{ marginBottom: 12, border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e' }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ fontWeight: 700 }}>У вас есть несохранённые изменения ({changes.length}).</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveDraft}>Сохранить черновик</button>
              <button className="ghost" onClick={resetToOriginal}>Отменить</button>
            </div>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <MatrixSkeleton />
      ) : isEmpty ? (
        <div className="panel"><div className="muted small">Нет данных о правах.</div></div>
      ) : !isError ? (
        <>
          <PermissionMatrix
            entries={filtered}
            catalog={catalog}
            editMode={editMode}
            draft={draft}
            originalMap={originalMap}
            onToggle={toggle}
          />
        </>
      ) : null}

      {showConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          onClick={() => !applyM.isPending && setShowConfirm(false)}
        >
          <div className="panel" style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Применить изменения прав?</h3>
            <div className="muted small" style={{ marginBottom: 10 }}>
              Будут изменены гранты для {changes.length} строк(и) матрицы. Действие применяется к системе и влияет на доступ пользователей.
            </div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {changes.map((c) => (
                <div key={entryKey(c.role, c.companyType)} className="card" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                  <div style={{ fontWeight: 700 }}>{c.role} · {c.companyType ?? 'Любой тип'}</div>
                  {c.add.map((x) => <div key={`a-${x}`} className="small" style={{ color: '#15803d' }}>+ {x}</div>)}
                  {c.remove.map((x) => <div key={`r-${x}`} className="small" style={{ color: '#b91c1c' }}>− {x}</div>)}
                </div>
              ))}
            </div>
            {applyError ? <div className="alert" style={{ marginBottom: 10 }}>{applyError}</div> : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowConfirm(false)} disabled={applyM.isPending}>Отмена</button>
              <button onClick={() => applyM.mutate()} disabled={applyM.isPending}>
                {applyM.isPending ? 'Применяем…' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
