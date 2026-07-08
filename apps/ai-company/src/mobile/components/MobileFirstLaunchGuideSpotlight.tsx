import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  mobileGuideTargetSelector,
  mobileGuideUnionRect,
} from '../guide/mobileFirstLaunchGuideConfig'

type Props = {
  active: boolean
  targetIds: string[]
  ariaLabel: string
}

const GUIDE_ACTIVE_CLASS = 'acMobileGuideActive'

export function MobileFirstLaunchGuideSpotlight({ active, targetIds, ariaLabel }: Props) {
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!active) {
      document.documentElement.classList.remove(GUIDE_ACTIVE_CLASS)
      setSpotlightRect(null)
      return
    }

    document.documentElement.classList.add(GUIDE_ACTIVE_CLASS)

    let cancelled = false
    let retryTimer: number | undefined

    function measure() {
      if (cancelled) return

      if (targetIds.length === 0) {
        setSpotlightRect(null)
        return
      }

      const elements = targetIds
        .map((targetId) => document.querySelector(mobileGuideTargetSelector(targetId)))
        .filter((node): node is Element => node instanceof Element)

      if (elements.length === 0) {
        retryTimer = window.setTimeout(measure, 120)
        return
      }

      elements[0]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setSpotlightRect(mobileGuideUnionRect(elements))
    }

    const raf = window.requestAnimationFrame(measure)
    retryTimer = window.setTimeout(measure, 180)

    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      if (retryTimer) window.clearTimeout(retryTimer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      document.documentElement.classList.remove(GUIDE_ACTIVE_CLASS)
    }
  }, [active, targetIds])

  if (!active) return null

  return createPortal(
    <div className="acMobileGuideOverlay" role="presentation" aria-label={ariaLabel}>
      {spotlightRect ? (
        <div
          className="acMobileGuideSpotlight"
          style={{
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
          }}
        />
      ) : (
        <div className="acMobileGuideDim" />
      )}
    </div>,
    document.body,
  )
}
