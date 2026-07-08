import { useTheme, type ThemePreference } from '../../theme'
import { useI18n } from '../../i18n'

const OPTIONS: ThemePreference[] = ['light', 'dark', 'system']

export function ThemeSwitch() {
  const { preference, setPreference } = useTheme()
  const { t } = useI18n()

  return (
    <div className="acThemeSwitch" role="group" aria-label={t.theme.toggle}>
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          className={preference === option ? 'acThemeBtn acThemeBtnActive' : 'acThemeBtn'}
          onClick={() => setPreference(option)}
          aria-pressed={preference === option}
          title={t.theme[option]}
        >
          {t.theme.short[option]}
        </button>
      ))}
    </div>
  )
}
