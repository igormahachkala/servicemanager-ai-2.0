import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PlatformGlossaryTermId } from '../domain/guided/platformGlossary'

type HelpCenterContextValue = {
  isOpen: boolean
  selectedTermId: PlatformGlossaryTermId | null
  openHelpCenter: (termId?: PlatformGlossaryTermId) => void
  closeHelpCenter: () => void
  selectTerm: (termId: PlatformGlossaryTermId) => void
}

const HelpCenterContext = createContext<HelpCenterContextValue | null>(null)

export function HelpCenterProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTermId, setSelectedTermId] = useState<PlatformGlossaryTermId | null>(null)

  const openHelpCenter = useCallback((termId?: PlatformGlossaryTermId) => {
    setSelectedTermId(termId ?? null)
    setIsOpen(true)
  }, [])

  const closeHelpCenter = useCallback(() => {
    setIsOpen(false)
  }, [])

  const selectTerm = useCallback((termId: PlatformGlossaryTermId) => {
    setSelectedTermId(termId)
  }, [])

  const value = useMemo(
    () => ({
      isOpen,
      selectedTermId,
      openHelpCenter,
      closeHelpCenter,
      selectTerm,
    }),
    [closeHelpCenter, isOpen, openHelpCenter, selectTerm, selectedTermId],
  )

  return createElement(HelpCenterContext.Provider, { value }, children)
}

export function useHelpCenter(): HelpCenterContextValue {
  const ctx = useContext(HelpCenterContext)
  if (!ctx) throw new Error('useHelpCenter must be used within HelpCenterProvider')
  return ctx
}
