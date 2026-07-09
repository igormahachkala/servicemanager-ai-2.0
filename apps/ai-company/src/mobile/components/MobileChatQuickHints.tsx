type Props = {
  hints: string[]
  disabled?: boolean
  onSelect: (hint: string) => void
}

export function MobileChatQuickHints({ hints, disabled, onSelect }: Props) {
  if (hints.length === 0) return null

  return (
    <div className="acMobileChatQuickHints" aria-label="Quick hints">
      {hints.map((hint) => (
        <button
          key={hint}
          type="button"
          className="acMobileChatQuickHint"
          disabled={disabled}
          onClick={() => onSelect(hint)}
        >
          {hint}
        </button>
      ))}
    </div>
  )
}
