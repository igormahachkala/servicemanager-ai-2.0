import { useState, type FormEvent } from 'react'
import { useI18n } from '../../../i18n'

export function DiscussionComposer(props: {
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
    <form className="mcDiscussionComposer" onSubmit={handleSubmit}>
      <textarea
        className="mcTextarea mcDiscussionComposerInput"
        rows={3}
        value={content}
        disabled={props.disabled}
        placeholder={t.discussions.composerPlaceholder}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="mcDiscussionComposerActions">
        <span className="mcFormHint">{t.discussions.composerHint}</span>
        <button type="submit" className="mcBtn mcBtnPrimary" disabled={props.disabled || !content.trim()}>
          {t.discussions.sendMessage}
        </button>
      </div>
    </form>
  )
}
