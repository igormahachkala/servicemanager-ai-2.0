import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useRef, type RefObject } from 'react'
import * as api from '../lib/api'
import { pushToast } from '../lib/appToast'
import { mapTicketActionError } from '../lib/ticketOperationalErrors'

export type PostCreateMode = 'redirect' | 'stay'

export type UseCreateTicketFlowParams = {
  isTechnician: boolean
  postCreateMode: PostCreateMode
  buildTicketLink: (ticketId: string) => string
  buildTicketScope: () => api.TicketScopeParams | undefined
  setErr: (v: string | null) => void
  setLastCreatedTicketId: (v: string) => void
  clearForNextCreate: () => void
  activeLocations: { id: string }[]
  setLocationId: (v: string) => void
  setDraftAttachment: (v: api.DraftTicketAttachment | null) => void
  setDraftAttachmentScopeKey: (v: string) => void
  setSelectedFile: (v: File | null) => void
  fileInputRef: RefObject<HTMLInputElement | null>
}

export function useCreateTicketFlow(p: UseCreateTicketFlowParams) {
  const qc = useQueryClient()
  const nav = useNavigate()
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

      if (submitAction === 'createAndClaim' && p.isTechnician) {
        try {
          await api.claim(createdId, p.buildTicketScope())
          pushToast('Заявка создана и взята в работу', 'success')
          nav(p.buildTicketLink(createdId))
          p.clearForNextCreate()
          return
        } catch (claimError: unknown) {
          const raw = claimError instanceof Error ? claimError.message : String(claimError)
          p.setErr(mapTicketActionError(raw))
          pushToast('Заявка создана, но взять в работу не удалось — откройте карточку', 'error')
          nav(p.buildTicketLink(createdId))
          return
        }
      }

      if (p.postCreateMode === 'stay') {
        p.setLastCreatedTicketId(createdId)
        p.clearForNextCreate()
        pushToast('Заявка создана', 'success')
        return
      }

      pushToast('Заявка создана', 'success')
      nav(p.buildTicketLink(createdId))
      p.clearForNextCreate()
    },
    onError: (e: unknown) => {
      const rawMessage = e instanceof Error ? e.message : String(e)
      if (rawMessage.includes('Some attachmentIds are invalid')) {
        p.setDraftAttachment(null)
        p.setDraftAttachmentScopeKey('')
        p.setSelectedFile(null)
        if (p.fileInputRef.current) p.fileInputRef.current.value = ''
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
