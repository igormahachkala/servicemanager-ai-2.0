import { useI18n } from '../../i18n'

export function MemorySearch(props: { value: string; onChange: (value: string) => void }) {
  const { t } = useI18n()

  return (
    <label className="mcField mcMemorySearch">
      <span className="mcFieldLabel">{t.memoryEngine.searchLabel}</span>
      <input
        className="mcInput"
        type="search"
        value={props.value}
        placeholder={t.memoryEngine.searchPlaceholder}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <span className="mcFormHint">{t.memoryEngine.searchHint}</span>
    </label>
  )
}
