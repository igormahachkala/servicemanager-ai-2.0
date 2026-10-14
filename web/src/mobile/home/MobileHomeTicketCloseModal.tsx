import { type MutableRefObject, useEffect, useRef, useState } from 'react'
import { type UseMutationResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../lib/api'
import { canOfferTicketClaimAction } from '../../lib/ticketActionCapabilities'
import {
  TICKET_MEDIA_ACCEPT,
  prepareOutgoingTicketMedia,
  ticketMediaKind,
} from '../../lib/ticketAttachmentMedia'
import { mobileTicketCategoryLocationFromCard, mobileTicketNumberTitle } from '../mobileTicketDisplay'
import { formatMobileMutationError } from '../mobileActionErrors'
import { queueOffline } from '../offline/useOffline'
import { deliverTicketStatus } from '../offline/statusDelivery'
import { ONLINE_ONLY_ACTION_MESSAGE } from '../offline/onlineOnlyMessage'

export type TicketCloseModalState = {
  ticketId: string
  title: string
  file: File | null
  previewUrl: string
  comment: string
  failureCauseId: string
  err: string
} | null

export function TicketCloseModal(props: {
  closeModal: TicketCloseModalState
  closeBusy: boolean
  closeCameraInputRef: MutableRefObject<HTMLInputElement | null>
  closeGalleryInputRef: MutableRefObject<HTMLInputElement | null>
  setCloseModal: (next: TicketCloseModalState | ((prev: TicketCloseModalState) => TicketCloseModalState)) => void
  closeCanSubmit: boolean
  closeM: UseMutationResult<void, unknown, void, unknown>
  failureCauses?: api.FailureCauseItem[]
  failureCausesLoading?: boolean
  failureCausesError?: string
  /** SMA-ACCEPTANCE-005: переопределение текстов для сценария «Отправить на приёмку». */
  heading?: string
  submitLabel?: string
  submitBusyLabel?: string
}) {
  const {
    closeModal,
    closeBusy,
    closeCameraInputRef,
    closeGalleryInputRef,
    setCloseModal,
    closeCanSubmit,
    closeM,
    failureCauses = [],
    failureCausesLoading = false,
    failureCausesError = '',
  } = props
  const heading = props.heading ?? 'Закрыть заявку'
  const submitLabel = props.submitLabel ?? 'Завершить'
  const submitBusyLabel = props.submitBusyLabel ?? 'Завершаем…'
  if (!closeModal) return null
  const setReportFile = (rawFile: File | null) => {
    void (async () => {
      if (!rawFile) {
        setCloseModal((prev) => {
          if (!prev) return prev
          if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
          return { ...prev, file: null, previewUrl: '', err: '' }
        })
        return
      }
      const prepared = await prepareOutgoingTicketMedia(rawFile)
      setCloseModal((prev) => {
        if (!prev) return prev
        if (prev.previewUrl) URL.revokeObjectURL(prev.previewUrl)
        if (prepared.error) return { ...prev, file: null, previewUrl: '', err: prepared.error }
        return { ...prev, file: prepared.file, previewUrl: URL.createObjectURL(prepared.file), err: '' }
      })
    })()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12 }}>
      <div className="mobileCard" style={{ width: '100%', maxWidth: 720, marginBottom: 12 }}>
        <div className="mobileRow" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 900 }}>{heading}</div>
            <div className="mobileMeta" style={{ marginTop: 4 }}>{closeModal.title}</div>
          </div>
          <button
            type="button"
            className="mobileBtn mobileBtnSecondary"
            disabled={closeBusy}
            onClick={() => {
              if (closeModal.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
              setCloseModal(null)
              if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
              if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
            }}
          >
            Отмена
          </button>
        </div>
        {closeModal.err ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 10 }}>{closeModal.err}</div> : null}
        <div className="mobileForm" style={{ marginTop: 12 }}>
          <div className="mobilePhotoCardBlock">
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Фото или видео отчёта *</div>
            <p className="mobileHint">Фото или видео результата обязательно для завершения заявки.</p>
            <input
              ref={closeCameraInputRef}
              className="mobileHiddenFileInput"
              type="file"
              accept={TICKET_MEDIA_ACCEPT}
              capture="environment"
              disabled={closeBusy}
              onChange={(e) => {
                setReportFile(e.target.files?.[0] || null)
              }}
            />
            <input
              ref={closeGalleryInputRef}
              className="mobileHiddenFileInput"
              type="file"
              accept={TICKET_MEDIA_ACCEPT}
              disabled={closeBusy}
              onChange={(e) => {
                setReportFile(e.target.files?.[0] || null)
              }}
            />
            <div className="mobilePhotoSourceRow">
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={closeBusy} onClick={() => closeCameraInputRef.current?.click()}>
                Снять фото/видео отчёта
              </button>
              <button type="button" className="mobileBtn mobileBtnSecondary mobilePhotoSourceBtn" disabled={closeBusy} onClick={() => closeGalleryInputRef.current?.click()}>
                Выбрать файл из телефона
              </button>
            </div>
            {closeModal.previewUrl ? (
              <div className="mobilePhotoPreview">
                {ticketMediaKind(closeModal.file || {}) === 'video' ? (
                  <video src={closeModal.previewUrl} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: 320, borderRadius: 12, border: '1px solid #e5e7eb', background: '#111827' }} />
                ) : (
                  <img src={closeModal.previewUrl} alt={closeModal.file?.name || 'preview'} style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 12, border: '1px solid #e5e7eb' }} />
                )}
              </div>
            ) : null}
            {closeModal.file ? <div className="mobileMeta" style={{ marginTop: 10 }}>Файл: {closeModal.file.name}</div> : null}
          </div>
          <label className="mobileFormFieldAfterPhoto">
            Причина неисправности *
            <select
              value={closeModal.failureCauseId}
              disabled={closeBusy || failureCausesLoading}
              onChange={(e) => setCloseModal((prev) => (prev ? { ...prev, failureCauseId: e.target.value, err: '' } : prev))}
            >
              <option value="">Выберите причину</option>
              {failureCauses.map((cause) => (
                <option key={cause.id} value={cause.id}>{cause.name}</option>
              ))}
            </select>
            {failureCausesLoading ? <div className="mobileMeta" style={{ marginTop: 6 }}>Загружаем причины…</div> : null}
            {failureCausesError ? <div className="mobileNotice mobileNoticeError" style={{ marginTop: 8 }}>{failureCausesError}</div> : null}
          </label>
          <label className="mobileFormFieldAfterPhoto">
            Комментарий к закрытию *
            <textarea
              rows={3}
              value={closeModal.comment}
              disabled={closeBusy}
              placeholder="Коротко: что сделали / результат"
              onChange={(e) => setCloseModal((prev) => (prev ? { ...prev, comment: e.target.value, err: '' } : prev))}
            />
          </label>
          <div className="mobileFormSubmitStack">
            <button type="button" className="mobileBtn mobileBtn--done" disabled={!closeCanSubmit} onClick={() => closeM.mutate()}>
              {closeBusy ? submitBusyLabel : submitLabel}
            </button>
            <p className="mobileHint" style={{ marginBottom: 0 }}>
              Комментарий не короче трёх символов. Сначала сохранится медиаотчёт, затем заявка перейдёт дальше по процессу.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

type UseMobileHomeTicketCloseModalArgs = {
  pageScope: api.TicketScopeParams
  liveApiAllowed: boolean
  me: api.Me | undefined
  setHomeActionErr: (text: string) => void
}

/** Состояние модалки закрытия + primary-action карточки (claim / start / открытие модалки). */
export function useMobileHomeTicketCloseModal(args: UseMobileHomeTicketCloseModalArgs) {
  const { pageScope, liveApiAllowed, me, setHomeActionErr } = args
  const queryClient = useQueryClient()
  const [startQueuedIds, setStartQueuedIds] = useState<Set<string>>(() => new Set())
  const [mobileActionToast, setMobileActionToast] = useState('')
  const closeCameraInputRef = useRef<HTMLInputElement | null>(null)
  const closeGalleryInputRef = useRef<HTMLInputElement | null>(null)
  const [closeModal, setCloseModal] = useState<TicketCloseModalState>(null)

  useEffect(() => {
    if (!mobileActionToast) return
    const tid = window.setTimeout(() => setMobileActionToast(''), 2800)
    return () => window.clearTimeout(tid)
  }, [mobileActionToast])

  useEffect(() => {
    return () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
    }
  }, [closeModal?.previewUrl])

  const actionM = useMutation({
    mutationFn: async (ticket: api.TicketCard) => {
      const role = me?.role
      if (ticket.status === 'NEW') {
        if (role === 'TECHNICIAN' && ticket.canRequestAssignment === true) {
          if (ticket.assignmentRequestedByCurrentUser) return
          await api.requestTicketAssignment(ticket.id, pageScope)
          return
        }
        if (!canOfferTicketClaimAction(ticket)) {
          throw new Error('Действие недоступно для этой заявки')
        }
        await api.claim(ticket.id, pageScope)
        return
      }
      if (ticket.status === 'ASSIGNED') {
        if (role !== 'TECHNICIAN' || ticket.assignedTechnician?.id !== me?.id) {
          throw new Error('Начать работу может только назначенный техник')
        }
        await api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, pageScope)
        return
      }
      if (ticket.status === 'IN_PROGRESS') {
        if (role !== 'TECHNICIAN' || ticket.assignedTechnician?.id !== me?.id) {
          throw new Error('Закрытие недоступно для этой заявки')
        }
        setCloseModal({
          ticketId: ticket.id,
          title: `${mobileTicketNumberTitle(ticket.ticketNumber)} — ${mobileTicketCategoryLocationFromCard(ticket)}`,
          file: null,
          previewUrl: '',
          comment: '',
          failureCauseId: '',
          err: '',
        })
      }
    },
    onMutate: () => setHomeActionErr(''),
    onSuccess: async (_data, ticket) => {
      if (ticket.status === 'IN_PROGRESS') return
      if (ticket.status === 'NEW' && me?.role === 'TECHNICIAN' && ticket.canRequestAssignment === true) {
        setMobileActionToast('Запрос отправлен')
      }
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-completed-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: unknown, ticket) => {
      const op =
        ticket.status === 'NEW' &&
        me?.role === 'TECHNICIAN' &&
        ticket.canRequestAssignment === true
          ? 'request_assignment'
          : ticket.status === 'NEW'
            ? 'claim'
            : ticket.status === 'ASSIGNED'
              ? 'start'
              : 'other'
      setHomeActionErr(formatMobileMutationError(e, { operation: op }))
    },
  })

  async function handlePrimaryAction(ticket: api.TicketCard) {
    // Claim и request assignment — только при liveApiAllowed.
    if (!liveApiAllowed && ticket.status === 'NEW') {
      setHomeActionErr(ONLINE_ONLY_ACTION_MESSAGE)
      return
    }
    if (ticket.status === 'ASSIGNED') {
      const role = me?.role
      if (role !== 'TECHNICIAN' || ticket.assignedTechnician?.id !== me?.id) {
        setHomeActionErr('Начать работу может только назначенный техник')
        return
      }
      const delivery = await deliverTicketStatus({
        reportedOnline: liveApiAllowed,
        queueInput: {
          kind: 'ticket.status',
          target: { ticketId: ticket.id },
          payload: { status: 'IN_PROGRESS', scope: pageScope },
        },
        send: async () => api.updateTicketStatus(ticket.id, { status: 'IN_PROGRESS' }, pageScope),
        enqueue: queueOffline,
      })
      if (delivery.kind === 'queue-failed') {
        setHomeActionErr(delivery.message)
        return
      }
      if (delivery.kind === 'queued') {
        setHomeActionErr('')
        setStartQueuedIds((prev) => new Set(prev).add(ticket.id))
        setMobileActionToast('Сохранено на устройстве. Будет отправлено после восстановления сети.')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      return
    }
    actionM.mutate(ticket)
  }

  const closeM = useMutation({
    mutationFn: async () => {
      if (!liveApiAllowed) {
        setCloseModal((prev) => (prev ? { ...prev, err: ONLINE_ONLY_ACTION_MESSAGE } : prev))
        throw new Error(ONLINE_ONLY_ACTION_MESSAGE)
      }
      if (!closeModal) throw new Error('Нет данных для закрытия')
      if (!closeModal.file) throw new Error('Нужно фото или видео отчёта')
      const comment = closeModal.comment.trim()
      if (comment.length < 3) throw new Error('Нужен короткий комментарий (backend требует комментарий для DONE)')
      const failureCauseId = closeModal.failureCauseId.trim()
      if (!failureCauseId) throw new Error('Выберите причину неисправности')
      const uploaded = await api.uploadTicketAttachment(closeModal.ticketId, closeModal.file, pageScope)
      await api.submitTicketAcceptance(
        closeModal.ticketId,
        {
          failureCauseId,
          comment,
          attachmentIds: uploaded?.id ? [uploaded.id] : undefined,
        },
        pageScope,
      )
    },
    onSuccess: async () => {
      if (closeModal?.previewUrl) URL.revokeObjectURL(closeModal.previewUrl)
      setCloseModal(null)
      if (closeCameraInputRef.current) closeCameraInputRef.current.value = ''
      if (closeGalleryInputRef.current) closeGalleryInputRef.current.value = ''
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-completed-board'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-home-available'] })
      await queryClient.invalidateQueries({ queryKey: ['mobile-my-board'] })
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    },
    onError: (e: unknown) => {
      const raw = e instanceof Error ? e.message : ''
      if (raw === ONLINE_ONLY_ACTION_MESSAGE) return
      setCloseModal((prev) => (prev ? { ...prev, err: formatMobileMutationError(e, { operation: 'close' }) } : prev))
    },
  })

  const closeBusy = closeM.isPending
  const closeCanSubmit =
    !!closeModal?.file &&
    closeModal.comment.trim().length >= 3 &&
    !!closeModal.failureCauseId.trim() &&
    !closeBusy

  const closeFailureCausesQ = useQuery({
    queryKey: ['ticket-failure-causes', closeModal?.ticketId, pageScope],
    queryFn: () => api.ticketFailureCauses(closeModal!.ticketId, pageScope),
    enabled: !!closeModal?.ticketId && liveApiAllowed,
  })

  return {
    startQueuedIds,
    mobileActionToast,
    actionM,
    handlePrimaryAction,
    closeBusy,
    closeModal,
    setCloseModal,
    closeCameraInputRef,
    closeGalleryInputRef,
    closeCanSubmit,
    closeM,
    closeFailureCauses: closeFailureCausesQ.data || [],
    closeFailureCausesLoading: closeFailureCausesQ.isFetching,
    closeFailureCausesError: closeFailureCausesQ.isError
      ? formatMobileMutationError(closeFailureCausesQ.error, { operation: 'other' })
      : '',
  }
}
