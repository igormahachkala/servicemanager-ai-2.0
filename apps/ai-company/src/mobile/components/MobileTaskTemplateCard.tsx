import type { MobileTaskTemplate, MobileTaskTemplateId } from '../runTask/mobileRunTaskConfig'

type MobileTaskTemplateCardProps = {
  template: MobileTaskTemplate
  selected: boolean
  onSelect: (templateId: MobileTaskTemplateId) => void
}

export function MobileTaskTemplateCard({ template, selected, onSelect }: MobileTaskTemplateCardProps) {
  const displayTitle = template.label ?? template.title

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
      <span className="acMobileTaskTemplateTitle">{displayTitle}</span>
      <span className="acMobileTaskTemplatePreview">{template.taskText.slice(0, 72)}…</span>
    </button>
  )
}
