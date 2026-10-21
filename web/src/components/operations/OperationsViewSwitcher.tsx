export type OperationsViewMode = 'registry' | 'board'

type OperationsViewSwitcherProps = {
  value: OperationsViewMode
  onChange: (value: OperationsViewMode) => void
}

const options: Array<{ value: OperationsViewMode; label: string }> = [
  { value: 'registry', label: 'Реестр' },
  { value: 'board', label: 'Доска' },
]

export function OperationsViewSwitcher({ value, onChange }: OperationsViewSwitcherProps) {
  return (
    <div className="operationsViewSwitcher" role="group" aria-label="Режим отображения заявок">
      {options.map((option) => {
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            className={active ? 'operationsViewSwitcherButton operationsViewSwitcherButtonActive' : 'operationsViewSwitcherButton'}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
