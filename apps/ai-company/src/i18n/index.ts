import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { en, type Messages } from './en'
import { ru } from './ru'

export type Language = 'en' | 'ru'

const STORAGE_KEY = 'ai-company-language'

const catalogs: Record<Language, Messages> = { en, ru }

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  return localStorage.getItem(STORAGE_KEY) === 'ru' ? 'ru' : 'en'
}

type LanguageContextValue = {
  language: Language
  t: Messages
  switchLanguage: (lang: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readStoredLanguage)

  const switchLanguage = useCallback((lang: Language) => {
    setLanguage(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* noop */
    }
  }, [])

  const value = useMemo(
    () => ({
      language,
      t: catalogs[language],
      switchLanguage,
    }),
    [language, switchLanguage],
  )

  return createElement(LanguageContext.Provider, { value }, children)
}

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider')
  return ctx
}

export function pageTitle(pathname: string, t: Messages): string {
  if (pathname === '/') return t.pages.flow
  if (pathname === '/ops') return t.pages.dashboard
  if (pathname === '/ops/organization') return t.pages.organization
  if (pathname === '/ops/employees') return t.pages.employees
  if (pathname === '/ops/employees/new') return t.employeeBuilder.title
  if (pathname === '/ops/tasks') return t.pages.tasks
  if (pathname === '/ops/feed') return t.pages.missionFeed
  if (pathname === '/ops/tools') return t.pages.toolsRegistry
  return t.pages.missionControl
}
