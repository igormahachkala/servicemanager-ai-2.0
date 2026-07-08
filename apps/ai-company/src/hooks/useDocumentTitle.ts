import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { pageTitle, useI18n } from '../i18n'

export function useDocumentTitle(explicitTitle?: string) {
  const { pathname } = useLocation()
  const { t } = useI18n()

  useEffect(() => {
    const page = explicitTitle ?? pageTitle(pathname, t)
    document.title = `${t.brand.title} — ${page}`
  }, [explicitTitle, pathname, t])
}
