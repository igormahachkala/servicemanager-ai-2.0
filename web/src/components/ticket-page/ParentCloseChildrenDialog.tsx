import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  PARENT_CLOSE_DIALOG_TEXT,
  applyConfirm,
  applyRejectFieldComplete,
  applyRowChoice,
  descendantCloseLinkLabel,
  descendantCloseRowHint,
  emptyChildCloseDraft,
  isDraftComplete,
  rowNeedsFieldCompleteConfirm,
  toChildResolutionsPayload,
  type ChildCloseDraftItem,
  type ChildCloseRowDraft,
  type UnresolvedDescendant,
} from '../../lib/ticketParentClose'

export type ParentCloseChildrenDialogProps = {
  open: boolean
  items: UnresolvedDescendant[]
  ticketHref: (id: string) => string
  pending?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (draft: ChildCloseDraftItem[]) => void
}

export function ParentCloseChildrenDialog(props: ParentCloseChildrenDialogProps) {
  const { open, items, ticketHref, pending = false, error = null, onCancel, onConfirm } = props
  const [draft, setDraft] = useState<ChildCloseRowDraft[]>([])
  const itemsSignature = useMemo(
    () => items.map((item) => `${item.id}:${item.status}`).join('|'),
    [items],
  )

  useEffect(() => {
    setDraft(open ? emptyChildCloseDraft(items) : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- сброс по open и составу строк, не по ссылке items
  }, [open, itemsSignature])

  useEffect(() => {
    if (!open || pending) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pending, onCancel])

  if (!open) return null

  const canSubmit = isDraftComplete(items, draft) && !pending

  const submit = () => {
    if (!isDraftComplete(items, draft) || pending) return
    onConfirm(toChildResolutionsPayload(items, draft))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="parent-close-children-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
        padding: 16,
      }}
      onClick={() => {
        if (!pending) onCancel()
      }}
    >
      <div
        className="panel uiCard"
        style={{ maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="parent-close-children-title" style={{ marginTop: 0, marginBottom: 8 }}>
          {PARENT_CLOSE_DIALOG_TEXT}
        </h3>

        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          {items.map((item) => {
            const row = draft.find((entry) => entry.ticketId === item.id)
            const confirmMode = rowNeedsFieldCompleteConfirm(item, row)
            return (
              <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
                <Link to={ticketHref(item.id)} style={{ fontWeight: 700, textDecoration: 'none' }}>
                  {descendantCloseLinkLabel(item)}
                </Link>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {descendantCloseRowHint(item)}
                </div>
                <div className="uiActions" style={{ marginTop: 10 }}>
                  {confirmMode ? (
                    <>
                      <button
                        type="button"
                        className={row?.resolution === 'FIELD_COMPLETE' ? undefined : 'ghost'}
                        disabled={pending}
                        onClick={() => setDraft((prev) => applyConfirm(prev, item.id))}
                      >
                        Подтверждаю
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={pending}
                        onClick={() => setDraft((prev) => applyRejectFieldComplete(prev, item.id))}
                      >
                        Нет
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={row?.resolution === 'FIELD_COMPLETE' ? undefined : 'ghost'}
                        disabled={pending}
                        onClick={() => setDraft((prev) => applyRowChoice(prev, item.id, 'FIELD_COMPLETE'))}
                      >
                        Выполнено
                      </button>
                      <button
                        type="button"
                        className={row?.resolution === 'CANCELED' ? undefined : 'ghost'}
                        disabled={pending}
                        onClick={() => setDraft((prev) => applyRowChoice(prev, item.id, 'CANCELED'))}
                      >
                        Отменено
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {error ? <div className="alert" style={{ marginBottom: 10 }}>{error}</div> : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="ghost" disabled={pending} onClick={onCancel}>
            Отмена
          </button>
          <button type="button" disabled={!canSubmit} onClick={submit}>
            {pending ? 'Отправляем…' : 'Ок'}
          </button>
        </div>
      </div>
    </div>
  )
}
