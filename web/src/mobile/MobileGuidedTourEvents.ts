export const MOBILE_TOUR_START_EVENT = 'sma-mobile-guided-tour:start'

export function startMobileGuidedTour() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MOBILE_TOUR_START_EVENT))
}
