import { useI18n, type Language } from '../i18n'

export function LanguageToggle() {
  const { language, switchLanguage, t } = useI18n()

  return (
    <div className="acLangToggle" role="group" aria-label={t.language.toggle}>
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
