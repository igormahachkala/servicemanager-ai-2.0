type Props = {
  value: string
  placeholder: string
  sendLabel: string
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function MobileChatComposer({
  value,
  placeholder,
  sendLabel,
  disabled,
  onChange,
  onSubmit,
}: Props) {
  return (
    <form
      className="acMobileChatComposer"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <textarea
        className="acMobileChatComposerInput"
        value={value}
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            onSubmit()
          }
        }}
      />
      <button type="submit" className="acMobilePrimaryBtn acMobileChatComposerSend" disabled={disabled || !value.trim()}>
        {sendLabel}
      </button>
    </form>
  )
}
