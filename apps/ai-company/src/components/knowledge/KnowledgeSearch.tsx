import { useI18n } from '../../i18n'

export function KnowledgeSearch({
  query,
  onChange,
}: {
  query: string
  onChange: (value: string) => void
}) {
  const { t } = useI18n()

  return (
    <label className="mcField mcMemorySearch">
      <span className="mcFieldLabel">{t.knowledgeEngine.searchLabel}</span>
      <input
        className="mcInput"
        type="search"
        value={query}
        placeholder={t.knowledgeEngine.searchPlaceholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
