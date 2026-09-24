import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import * as api from '../lib/api'
import { pushToast } from '../lib/appToast'
import { mapTicketActionError } from '../lib/ticketOperationalErrors'

export type CreateSuccessResult = {
  ticketId: string
  ticketNumber?: number | null
  autoAssigned?: boolean
  generatedTitle?: string
}

export type UseCreateTicketFlowParams = {
  isTechnician: boolean
  buildTicketLink: (ticketId: string) => string
  buildTicketScope: () => api.TicketScopeParams | undefined
  setErr: (v: string | null) => void
  onCreateSuccess: (result: CreateSuccessResult) => void
  clearForNextCreate: () => void
  activeLocations: { id: string }[]
  setLocationId: (v: string) => void
  setDraftAttachment: (v: api.DraftTicketAttachment | null) => void
  setDraftAttachmentScopeKey: (v: string) => void
  setSelectedFile: (v: File | null) => void
  resetFileInput: () => void
}

export function useCreateTicketFlow(p: UseCreateTicketFlowParams) {
  const qc = useQueryClient()
  const submitActionRef = useRef<'create' | 'createAndClaim'>('create')

  const createM = useMutation({
    mutationFn: (payload: api.CreateTicketInput) => api.createTicket(payload, p.buildTicketScope()),
    onSuccess: async (created) => {
      await qc.invalidateQueries({ queryKey: ['board'] })
      await qc.invalidateQueries({ queryKey: ['tickets'] })
      await qc.invalidateQueries({ queryKey: ['mobile-notifications'] })
      await qc.invalidateQueries({ queryKey: ['mobile-home-board'] })
      await qc.invalidateQueries({ queryKey: ['mobile-my-board'] })

      const createdId = api.extractCreatedTicketId(created)
      if (!createdId) {
        p.setErr('Не удалось определить id созданной заявки из ответа сервера.')
        pushToast('Заявка создана, но не удалось открыть карточку', 'error')
        return
      }

      const submitAction = submitActionRef.current
      submitActionRef.current = 'create'
      const postCreateActionResult = created.postCreateActionResult
      const claimSelfBlockMessage =
        postCreateActionResult?.action === 'claim_self' &&
        postCreateActionResult.ok === false
          ? postCreateActionResult.message
          : null

      if (submitAction === 'createAndClaim' && p.isTechnician) {
        if (claimSelfBlockMessage) {
          pushToast(claimSelfBlockMessage, 'error')
        }
        p.onCreateSuccess({
          ticketId: createdId,
          ticketNumber: created.ticket?.ticketNumber,
          autoAssigned: !claimSelfBlockMessage,
          generatedTitle: created.generated?.title,
        })
        p.clearForNextCreate()
        return
      }

      p.onCreateSuccess({
        ticketId: createdId,
        ticketNumber: created.ticket?.ticketNumber,
        autoAssigned: created.autoAssigned,
        generatedTitle: created.generated?.title,
      })
      p.clearForNextCreate()
    },
    onError: (e: unknown) => {
      const rawMessage = e instanceof Error ? e.message : String(e)
      if (rawMessage.includes('Some attachmentIds are invalid')) {
        p.setDraftAttachment(null)
        p.setDraftAttachmentScopeKey('')
        p.setSelectedFile(null)
        p.resetFileInput()
        p.setErr(
          'Не удалось привязать фото: вложение устарело для текущего контура. Загрузите фото заново.',
        )
        return
      }
      if (rawMessage.includes('Location not found')) {
        const fallbackLocationId = p.activeLocations[0]?.id || ''
        p.setLocationId(fallbackLocationId)
        p.setErr('Выбранная локация больше недоступна. Выберите точку снова.')
        return
      }
      p.setErr(mapTicketActionError(rawMessage))
    },
  })

  return { createM, submitActionRef }
}
