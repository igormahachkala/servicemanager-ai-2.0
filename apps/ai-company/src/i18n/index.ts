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
  if (pathname === '/ops/canvas') return t.pages.canvas
  if (pathname === '/ops/organization') return t.pages.organization
  if (pathname.startsWith('/ops/organization/departments/')) return t.organizationEngine.departmentPage
  if (pathname.startsWith('/ops/organization/teams/')) return t.organizationEngine.teamPage
  if (pathname === '/ops/employees') return t.pages.employees
  if (pathname === '/ops/employees/new') return t.employeeBuilder.title
  if (pathname.includes('/conversation')) return t.chats.types.direct
  if (pathname.includes('/memory')) return t.memoryEngine.title
  if (pathname.startsWith('/ops/employees/')) return t.employeeProfile.title
  if (pathname === '/ops/tasks') return t.pages.tasks
  if (pathname === '/ops/execution') return t.pages.execution
  if (pathname === '/ops/visual-lab') return t.pages.visualLab
  if (pathname === '/ops/chats') return t.pages.chats
  if (pathname === '/ops/chats/new') return t.chats.newChat
  if (pathname.startsWith('/ops/chats/')) return t.pages.chats
  if (pathname === '/ops/discussions') return t.pages.chats
  if (pathname === '/ops/discussions/new') return t.chats.newChat
  if (pathname.startsWith('/ops/discussions/')) return t.pages.chats
  if (pathname === '/ops/presence') return t.pages.presence
  if (pathname === '/ops/projects') return t.pages.projects
  if (pathname === '/ops/projects/new') return t.projects.newProject
  if (pathname.startsWith('/ops/projects/')) return t.pages.projects
  if (pathname === '/ops/workspaces') return t.pages.workspaces
  if (pathname === '/ops/workspaces/new') return t.workspaces.newWorkspace
  if (pathname.startsWith('/ops/workspaces/')) return t.pages.workspaces
  if (pathname === '/ops/knowledge') return t.pages.knowledge
  if (pathname === '/ops/knowledge/collections') return t.knowledgeEngine.collectionsTitle
  if (pathname.startsWith('/ops/knowledge/')) return t.pages.knowledge
  if (pathname === '/ops/feed') return t.pages.missionFeed
  if (pathname === '/ops/timeline') return t.pages.companyTimeline
  if (pathname === '/ops/activity') return t.pages.activity
  if (pathname === '/ops/approvals') return t.pages.approvals
  if (pathname.startsWith('/ops/approvals/')) return t.pages.approvals
  if (pathname === '/ops/tools') return t.pages.toolsRegistry
  if (pathname.startsWith('/ops/tools/')) return t.toolRegistry.detailsTitle
  if (pathname === '/ops/tool-executions') return t.pages.toolExecutions
  if (pathname === '/ops/reports') return t.pages.reports
  if (pathname.startsWith('/ops/reports/')) return t.pages.reports
  if (pathname === '/ops/runs') return t.pages.runs
  if (pathname.startsWith('/ops/runs/')) return t.pages.runs
  if (pathname === '/ops/audit') return t.pages.audit
  if (pathname === '/ops/runtime/live') return t.pages.runtimeLive
  if (pathname === '/ops/runtime') return t.pages.runtimeSettings
  if (pathname.startsWith('/ops/runtime/runs/')) return t.runtimeOrchestrator.runPageTitle
  if (pathname.startsWith('/ops/employees/') && pathname.endsWith('/runtime')) {
    return t.runtimeEngine.employeeRuntimePage
  }
  return t.pages.missionControl
}
