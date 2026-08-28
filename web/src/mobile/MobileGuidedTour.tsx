import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { safeGetItem, safeSetItem } from '../lib/browserStorage'
import { MOBILE_TOUR_START_EVENT } from './MobileGuidedTourEvents'
import { getMobileRouteRoot, mobilePath } from './mobileRoute'

const MOBILE_TOUR_STORAGE_PREFIX = 'sma.mobileGuidedTour.v1'
const CARD_WIDTH = 336
const CARD_HEIGHT_ESTIMATE = 236

type MobileGuidedTourProps = {
  userKey?: string | null
}

type TourPhase = 'idle' | 'welcome' | 'steps' | 'done'

type TourStep = {
  target: string
  routeSuffix: string
  text: string
  fallbackTargets?: string[]
}

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
  bottom: number
}

type CardPosition = {
  top: number
  left: number
  width: number
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'main-menu',
    routeSuffix: '',
    text: 'Здесь находятся основные разделы приложения.',
  },
  {
    target: 'ticket-list',
    routeSuffix: '',
    text: 'Здесь отображаются все ваши заявки.',
  },
  {
    target: 'create-ticket',
    routeSuffix: '',
    text: 'Нажмите здесь, чтобы оформить новую заявку.',
  },
  {
    target: 'create-form',
    routeSuffix: '/create',
    text: 'Заполните основные данные по проблеме.',
  },
  {
    target: 'photo-upload',
    routeSuffix: '/create',
    text: 'При необходимости прикрепите фотографии.',
  },
  {
    target: 'submit-ticket',
    routeSuffix: '/create',
    text: 'После отправки заявка сразу попадет исполнителю.',
  },
  {
    target: 'ticket-card',
    routeSuffix: '',
    text: 'Здесь отображается статус, комментарии и история работы.',
    fallbackTargets: ['ticket-list'],
  },
  {
    target: 'ticket-filters',
    routeSuffix: '',
    text: 'Используйте фильтры для быстрого поиска нужной заявки.',
    fallbackTargets: ['ticket-list'],
  },
]

function storageKeyFor(userKey?: string | null) {
  const normalized = (userKey || 'anonymous').trim() || 'anonymous'
  return `${MOBILE_TOUR_STORAGE_PREFIX}.${normalized}`
}

function readTourSeen(storageKey: string) {
  if (typeof window === 'undefined') return true
  const stored = safeGetItem('local', storageKey, null)
  return stored === 'completed' || stored === 'skipped'
}

function writeTourSeen(storageKey: string, value: 'completed' | 'skipped') {
  if (typeof window === 'undefined') return
  if (value === 'skipped' && safeGetItem('local', storageKey, null) === 'completed') return
  safeSetItem('local', storageKey, value)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function mobileTourRootPath(pathname: string) {
  return getMobileRouteRoot(pathname)
}

function buildTourPath(pathname: string, search: string, routeSuffix: string) {
  const base = routeSuffix ? mobilePath(pathname, routeSuffix) : mobileTourRootPath(pathname)
  return `${base}${search || ''}`
}

function findTourTarget(step: TourStep) {
  const selectors = [step.target, ...(step.fallbackTargets || [])]
  for (const target of selectors) {
    const el = document.querySelector<HTMLElement>(`[data-mobile-tour="${target}"]`)
    if (el) return el
  }
  return null
}

function rectFromElement(el: HTMLElement): SpotlightRect {
  const rect = el.getBoundingClientRect()
  const margin = 8
  const top = clamp(rect.top - margin, 8, window.innerHeight - 24)
  const left = clamp(rect.left - margin, 8, window.innerWidth - 24)
  const right = clamp(rect.right + margin, left + 24, window.innerWidth - 8)
  const bottom = clamp(rect.bottom + margin, top + 24, window.innerHeight - 8)
  return {
    top,
    left,
    width: Math.max(24, right - left),
    height: Math.max(24, bottom - top),
    bottom,
  }
}

function positionCard(spotlight: SpotlightRect | null): CardPosition {
  const viewportWidth = window.innerWidth || 360
  const viewportHeight = window.innerHeight || 640
  const width = Math.min(CARD_WIDTH, viewportWidth - 28)

  if (!spotlight) {
    return {
      width,
      left: Math.max(14, (viewportWidth - width) / 2),
      top: Math.max(18, (viewportHeight - CARD_HEIGHT_ESTIMATE) / 2),
    }
  }

  const centerLeft = spotlight.left + spotlight.width / 2 - width / 2
  const left = clamp(centerLeft, 14, viewportWidth - width - 14)
  const below = spotlight.bottom + 14
  const above = spotlight.top - CARD_HEIGHT_ESTIMATE - 14

  if (below + CARD_HEIGHT_ESTIMATE <= viewportHeight - 12) {
    return { width, left, top: below }
  }
  if (above >= 12) {
    return { width, left, top: above }
  }
  return {
    width,
    left,
    top: clamp(viewportHeight - CARD_HEIGHT_ESTIMATE - 14, 14, viewportHeight - 120),
  }
}

export function MobileGuidedTour({ userKey }: MobileGuidedTourProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const storageKey = useMemo(() => storageKeyFor(userKey), [userKey])
  const autoPromptedRef = useRef(false)
  const [phase, setPhase] = useState<TourPhase>('idle')
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [cardPosition, setCardPosition] = useState<CardPosition>(() => ({ top: 20, left: 14, width: CARD_WIDTH }))

  const activeStep = phase === 'steps' ? TOUR_STEPS[stepIndex] : null

  useEffect(() => {
    if (!userKey || autoPromptedRef.current) return
    autoPromptedRef.current = true
    if (!readTourSeen(storageKey)) {
      const timer = window.setTimeout(() => {
        setPhase('welcome')
        setStepIndex(0)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [storageKey, userKey])

  useEffect(() => {
    const onManualStart = () => {
      setStepIndex(0)
      setPhase('welcome')
    }
    window.addEventListener(MOBILE_TOUR_START_EVENT, onManualStart)
    return () => window.removeEventListener(MOBILE_TOUR_START_EVENT, onManualStart)
  }, [])

  useEffect(() => {
    if (!activeStep) return
    const nextPath = buildTourPath(location.pathname, location.search, activeStep.routeSuffix)
    const currentPath = `${location.pathname}${location.search}`
    if (nextPath !== currentPath) navigate(nextPath, { replace: true })
  }, [activeStep, location.pathname, location.search, navigate])

  const updateSpotlight = useCallback(() => {
    if (!activeStep || typeof window === 'undefined') {
      setSpotlight(null)
      setCardPosition(positionCard(null))
      return
    }
    const target = findTourTarget(activeStep)
    if (!target) {
      setSpotlight(null)
      setCardPosition(positionCard(null))
      return
    }

    const rect = target.getBoundingClientRect()
    if (rect.top < 8 || rect.bottom > window.innerHeight - 8) {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }

    const nextSpotlight = rectFromElement(target)
    setSpotlight(nextSpotlight)
    setCardPosition(positionCard(nextSpotlight))
  }, [activeStep])

  useLayoutEffect(() => {
    if (phase !== 'steps') return
    let frame = window.requestAnimationFrame(updateSpotlight)
    const timer = window.setTimeout(updateSpotlight, 240)
    const onReposition = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(updateSpotlight)
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [phase, stepIndex, location.pathname, updateSpotlight])

  function finish(value: 'completed' | 'skipped') {
    writeTourSeen(storageKey, value)
    setPhase('idle')
    setStepIndex(0)
    setSpotlight(null)
  }

  function startSteps() {
    setStepIndex(0)
    setPhase('steps')
  }

  function goNext() {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      setPhase('done')
      setSpotlight(null)
      setCardPosition(positionCard(null))
      return
    }
    setStepIndex((prev) => prev + 1)
  }

  function goBack() {
    setStepIndex((prev) => Math.max(0, prev - 1))
  }

  if (phase === 'idle') return null

  if (phase === 'welcome') {
    return (
      <div className="mobileGuidedTourLayer" role="dialog" aria-modal="true" aria-labelledby="mobile-tour-welcome-title">
        <div className="mobileGuidedTourBackdrop" />
        <div className="mobileGuidedTourCard mobileGuidedTourCard--center">
          <div className="mobileGuidedTourBrand">Сервис Менеджер</div>
          <h2 id="mobile-tour-welcome-title" className="mobileGuidedTourTitle">
            Добро пожаловать в Сервис Менеджер
          </h2>
          <p className="mobileGuidedTourText">
            Мы покажем основные возможности мобильной версии. Это займет около минуты.
          </p>
          <div className="mobileGuidedTourActions">
            <button type="button" className="mobileBtn" onClick={startSteps}>
              Начать
            </button>
            <button type="button" className="mobileBtn mobileBtnSecondary" onClick={() => finish('skipped')}>
              Пропустить
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="mobileGuidedTourLayer" role="dialog" aria-modal="true" aria-labelledby="mobile-tour-done-title">
        <div className="mobileGuidedTourBackdrop" />
        <div className="mobileGuidedTourCard mobileGuidedTourCard--center">
          <div className="mobileGuidedTourDoneIcon" aria-hidden>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5 -5" />
            </svg>
          </div>
          <h2 id="mobile-tour-done-title" className="mobileGuidedTourTitle">
            🎉 Обучение завершено.
          </h2>
          <p className="mobileGuidedTourText">Желаем приятной работы!</p>
          <button type="button" className="mobileBtn" onClick={() => finish('completed')}>
            Начать работу
          </button>
        </div>
      </div>
    )
  }

  const progress = `${stepIndex + 1}/${TOUR_STEPS.length}`
  return (
    <div className="mobileGuidedTourLayer" role="dialog" aria-modal="true" aria-labelledby="mobile-tour-step-title">
      {spotlight ? (
        <div
          className="mobileGuidedTourSpotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      ) : (
        <div className="mobileGuidedTourBackdrop" />
      )}
      <div
        className="mobileGuidedTourCard"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
          width: cardPosition.width,
        }}
      >
        <div className="mobileGuidedTourProgress">{progress}</div>
        <h2 id="mobile-tour-step-title" className="mobileGuidedTourTitle">
          Быстрый старт
        </h2>
        <p className="mobileGuidedTourText">{activeStep?.text}</p>
        <div className="mobileGuidedTourActions mobileGuidedTourActions--step">
          <button type="button" className="mobileBtn mobileBtnSecondary" onClick={goBack} disabled={stepIndex === 0}>
            Назад
          </button>
          <button type="button" className="mobileBtn" onClick={goNext}>
            {stepIndex === TOUR_STEPS.length - 1 ? 'Завершить' : 'Далее'}
          </button>
        </div>
        <button type="button" className="mobileGuidedTourSkip" onClick={() => finish('skipped')}>
          Пропустить обучение
        </button>
      </div>
    </div>
  )
}
