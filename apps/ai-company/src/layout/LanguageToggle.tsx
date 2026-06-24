import { useI18n, type Language } from '../i18n'

export function LanguageToggle() {
  const { language, switchLanguage } = useI18n()

  return (
    <div className="acLangToggle" role="group" aria-label="Language">
      {(['en', 'ru'] as Language[]).map((lang) => (
        <button
          key={lang}
          type="button"
          className={language === lang ? 'acLangBtn acLangBtnActive' : 'acLangBtn'}
          onClick={() => switchLanguage(lang)}
          aria-pressed={language === lang}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
