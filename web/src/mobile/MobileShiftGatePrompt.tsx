import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { safeGetItem, safeSetItem } from '../lib/browserStorage'
import * as api from '../lib/api'
import { MobileModalBackdrop } from './MobileModalBackdrop'
import {
  ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE,
  SHIFT_GATE_DISMISSAL_STORAGE_AREA,
  type ShiftGatePromptStage,
  isActiveShiftRequiredError,
  reduceShiftGatePrompt,
  shiftGateDayKey,
  shiftGateDismissalKey,
  shouldFetchShiftGateState,
  shouldShowShiftGatePrompt,
} from './mobileShiftGate'

type Props = {
  user?: api.Me | null
}

const OPEN_SHIFT_ERROR = 'Не удалось открыть смену. Проверьте соединение и повторите.'

export function MobileShiftGatePrompt({ user }: Props) {
  const queryClient = useQueryClient()
  const [confirmationKey, setConfirmationKey] = useState<string | null>(null)
  const [dismissedByAction, setDismissedByAction] = useState<Record<string, true>>({})
  const [error, setError] = useState('')

  const enabled = shouldFetchShiftGateState(user)
  const stateQ = useQuery({
    queryKey: ['workforce-me'],
    queryFn: api.workforceMyState,
    enabled,
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  })

  const companyId = stateQ.data?.company?.id || user?.companyId || ''
  const dismissalKey = user?.id && companyId
    ? shiftGateDismissalKey({
      userId: user.id,
      companyId,
      dayKey: shiftGateDayKey(),
    })
    : ''
  const promptRequired = shouldShowShiftGatePrompt(user, stateQ.data)
  const dismissed = dismissalKey
    ? Boolean(dismissedByAction[dismissalKey] || safeGetItem(SHIFT_GATE_DISMISSAL_STORAGE_AREA, dismissalKey, null))
    : false
  const stage: ShiftGatePromptStage = promptRequired && dismissalKey && !dismissed
    ? confirmationKey === dismissalKey ? 'confirm' : 'initial'
    : 'closed'

  const openM = useMutation({
    mutationFn: api.openWorkShift,
    onMutate: () => setError(''),
    onSuccess: async (data) => {
      queryClient.setQueryData(['workforce-me'], data)
      setConfirmationKey(null)
      await queryClient.invalidateQueries({ queryKey: ['workforce-me'] })
      await queryClient.invalidateQueries({ queryKey: ['workforce-report'] })
    },
    onError: (err: unknown) => {
      setError(isActiveShiftRequiredError(err) ? ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE : OPEN_SHIFT_ERROR)
      setConfirmationKey(dismissalKey || null)
    },
  })

  const dismiss = (event: 'not_now' | 'cancel') => {
    const next = reduceShiftGatePrompt(stage, event)
    if (next.dismiss && dismissalKey) {
      safeSetItem(SHIFT_GATE_DISMISSAL_STORAGE_AREA, dismissalKey, '1')
      setDismissedByAction((current) => ({ ...current, [dismissalKey]: true }))
    }
    setError('')
    setConfirmationKey(null)
  }

  const askForConfirmation = () => {
    setError('')
    const next = reduceShiftGatePrompt(stage, 'yes')
    if (next.stage === 'confirm' && dismissalKey) setConfirmationKey(dismissalKey)
  }

  const confirmOpen = () => {
    const next = reduceShiftGatePrompt(stage, 'confirm_open')
    if (next.openShift) openM.mutate()
  }

  if (!enabled || stage === 'closed') return null

  const isConfirm = stage === 'confirm'

  return (
    <MobileModalBackdrop ariaLabel="Рабочая смена" align="center" onClose={() => dismiss(isConfirm ? 'cancel' : 'not_now')}>
      <div className="mobileAssignModal mobileShiftGatePrompt">
        {isConfirm ? (
          <>
            <div className="mobileSectionTitle">Открыть рабочую смену?</div>
            <p className="mobileHint">Вы уверены?</p>
            {error ? <div className="mobileNotice mobileNoticeError">{error}</div> : null}
            <div className="mobileShiftGateActions">
              <button type="button" className="mobileBtn" disabled={openM.isPending} onClick={confirmOpen}>
                {openM.isPending ? 'Открываем…' : 'Да, открыть'}
              </button>
              <button type="button" className="mobileBtn mobileBtnSecondary" disabled={openM.isPending} onClick={() => dismiss('cancel')}>
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mobileSectionTitle">У вас не открыта рабочая смена.</div>
            <p className="mobileHint">Открыть смену?</p>
            <div className="mobileShiftGateActions">
              <button type="button" className="mobileBtn" onClick={askForConfirmation}>
                Да
              </button>
              <button type="button" className="mobileBtn mobileBtnSecondary" onClick={() => dismiss('not_now')}>
                Не сейчас
              </button>
            </div>
          </>
        )}
      </div>
    </MobileModalBackdrop>
  )
}
