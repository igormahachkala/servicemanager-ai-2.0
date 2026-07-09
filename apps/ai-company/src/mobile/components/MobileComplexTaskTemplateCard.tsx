import type {
  MobileComplexTaskTemplate,
  MobileComplexTaskTemplateId,
} from '../tasks/mobileComplexTaskPayload'

type MobileComplexTaskTemplateCardProps = {
  template: MobileComplexTaskTemplate
  selected: boolean
  onSelect: (templateId: MobileComplexTaskTemplateId) => void
}

export function MobileComplexTaskTemplateCard({
  template,
  selected,
  onSelect,
}: MobileComplexTaskTemplateCardProps) {
  return (
    <button
      type="button"
      className={
        selected
          ? 'acMobileTaskTemplateCard acMobileTaskTemplateCardSelected'
          : 'acMobileTaskTemplateCard'
      }
      aria-pressed={selected}
      onClick={() => onSelect(template.id)}
    >
      <span className="acMobileTaskTemplateTitle">{template.title}</span>
      <span className="acMobileTaskTemplatePreview">{template.objective.slice(0, 72)}…</span>
    </button>
  )
}
