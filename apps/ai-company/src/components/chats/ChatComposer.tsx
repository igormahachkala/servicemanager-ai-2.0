import { useState, type FormEvent } from 'react'
import { useI18n } from '../../i18n'

export function ChatComposer(props: {
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
    <form className="mcChatComposer" onSubmit={handleSubmit}>
      <textarea
        className="mcTextarea mcChatComposerInput"
        rows={3}
        value={content}
        disabled={props.disabled}
        placeholder={t.chats.composerPlaceholder}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="mcChatComposerToolbar">
        <span className="mcFormHint">{t.chats.mentionHint}</span>
      </div>
      <div className="mcChatComposerActions">
        <span className="mcFormHint">{t.chats.composerHint}</span>
        <button type="submit" className="mcBtn mcBtnPrimary" disabled={props.disabled || !content.trim()}>
          {t.chats.sendMessage}
        </button>
      </div>
    </form>
  )
}
