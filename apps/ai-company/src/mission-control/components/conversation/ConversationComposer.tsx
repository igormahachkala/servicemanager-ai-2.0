import { useState, type FormEvent } from 'react'
import { useI18n } from '../../../i18n'

export function ConversationComposer(props: {
  disabled?: boolean
  onSend: (content: string) => void
}) {
  const { t } = useI18n()
  const [content, setContent] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || props.disabled) return
    props.onSend(trimmed)
    setContent('')
  }

  return (
    <form className="mcConversationComposer" onSubmit={handleSubmit}>
      <textarea
        className="mcTextarea mcConversationComposerInput"
        rows={3}
        value={content}
        disabled={props.disabled}
        placeholder={t.conversations.composerPlaceholder}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="mcConversationComposerActions">
        <span className="mcFormHint">{t.conversations.composerHint}</span>
        <button type="submit" className="mcBtn mcBtnPrimary" disabled={props.disabled || !content.trim()}>
          {t.conversations.sendMessage}
        </button>
      </div>
    </form>
  )
}
