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
} from '../lib/ticketParentClose'

export type MobileParentCloseChildrenSheetProps = {
  open: boolean
  items: UnresolvedDescendant[]
  ticketHref: (id: string) => string
  pending?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: (draft: ChildCloseDraftItem[]) => void
}

export function MobileParentCloseChildrenSheet(props: MobileParentCloseChildrenSheetProps) {
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
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, pending, onCancel])

  if (!open) return null

  const canSubmit = isDraftComplete(items, draft) && !pending

  const submit = () => {
    if (!isDraftComplete(items, draft) || pending) return
    onConfirm(toChildResolutionsPayload(items, draft))
  }

  return (
    <div
      className="mobileParentCloseBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-parent-close-children-title"
      onClick={() => {
        if (!pending) onCancel()
      }}
    >
      <div className="mobileCard mobileParentCloseSheet" onClick={(event) => event.stopPropagation()}>
        <div id="mobile-parent-close-children-title" className="mobileParentCloseTitle">
          {PARENT_CLOSE_DIALOG_TEXT}
        </div>

        {error ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{error}</div> : null}

        <div className="mobileParentCloseList">
          {items.map((item) => {
            const row = draft.find((entry) => entry.ticketId === item.id)
            const confirmMode = rowNeedsFieldCompleteConfirm(item, row)
            return (
              <div key={item.id} className="mobileParentCloseRow">
                <Link className="mobileParentCloseLink" to={ticketHref(item.id)}>
                  {descendantCloseLinkLabel(item)}
                </Link>
                <div className="mobileMeta mobileParentCloseHint">{descendantCloseRowHint(item)}</div>
                <div className="mobileParentCloseRowActions">
                  {confirmMode ? (
                    <>
                      <button
                        type="button"
                        className={`mobileBtn${row?.resolution === 'FIELD_COMPLETE' ? '' : ' mobileBtnSecondary'}`}
                        disabled={pending}
                        onClick={() => setDraft((prev) => applyConfirm(prev, item.id))}
                      >
                        Подтверждаю
                      </button>
                      <button
                        type="button"
                        className="mobileBtn mobileBtnSecondary"
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
                        className={`mobileBtn${row?.resolution === 'FIELD_COMPLETE' ? '' : ' mobileBtnSecondary'}`}
                        disabled={pending}
                        onClick={() => setDraft((prev) => applyRowChoice(prev, item.id, 'FIELD_COMPLETE'))}
                      >
                        Выполнено
                      </button>
                      <button
                        type="button"
                        className={`mobileBtn${row?.resolution === 'CANCELED' ? '' : ' mobileBtnSecondary'}`}
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

        <div className="mobileParentCloseFooter">
          <button type="button" className="mobileBtn mobileBtnSecondary" disabled={pending} onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="mobileBtn" disabled={!canSubmit} onClick={submit}>
            {pending ? 'Отправляем…' : 'Ок'}
          </button>
        </div>
      </div>
    </div>
  )
}
