import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type MobileBottomSheetOptions = {
  title?: string
  ariaLabel?: string
  onClose?: () => void
}

type MobileBottomSheetContextValue = {
  isOpen: boolean
  title?: string
  ariaLabel?: string
  content: ReactNode | null
  openSheet: (content: ReactNode, options?: MobileBottomSheetOptions) => void
  closeSheet: () => void
}

const MobileBottomSheetContext = createContext<MobileBottomSheetContextValue | null>(null)

export function useMobileBottomSheet(): MobileBottomSheetContextValue {
  const ctx = useContext(MobileBottomSheetContext)
  if (!ctx) {
    throw new Error('useMobileBottomSheet must be used within MobileBottomSheetHost')
  }
  return ctx
}

export function MobileBottomSheetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState<string | undefined>()
  const [ariaLabel, setAriaLabel] = useState<string | undefined>()
  const [content, setContent] = useState<ReactNode | null>(null)
  const onCloseRef = useRef<(() => void) | undefined>(undefined)

  const closeSheet = useCallback(() => {
    setIsOpen(false)
    onCloseRef.current?.()
    onCloseRef.current = undefined
    setTitle(undefined)
    setAriaLabel(undefined)
    setContent(null)
  }, [])

  const openSheet = useCallback((nextContent: ReactNode, options?: MobileBottomSheetOptions) => {
    setContent(nextContent)
    setTitle(options?.title)
    setAriaLabel(options?.ariaLabel ?? options?.title)
    onCloseRef.current = options?.onClose
    setIsOpen(true)
  }, [])

  const value = useMemo(
    () => ({
      isOpen,
      title,
      ariaLabel,
      content,
      openSheet,
      closeSheet,
    }),
    [isOpen, title, ariaLabel, content, openSheet, closeSheet],
  )

  return (
    <MobileBottomSheetContext.Provider value={value}>
      {children}
    </MobileBottomSheetContext.Provider>
  )
}
