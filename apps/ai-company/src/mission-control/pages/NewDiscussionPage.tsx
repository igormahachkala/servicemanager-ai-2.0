import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../components/ui'
import { getDiscussionRoster } from '../data/discussion'
import { useDiscussions } from '../hooks/useDiscussion'
import { useI18n } from '../../i18n'

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

export function NewDiscussionPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { create } = useDiscussions()
  const roster = useMemo(() => getDiscussionRoster(), [])
  const [title, setTitle] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError(t.discussions.errors.titleRequired)
      return
    }
    if (selectedIds.length === 0) {
      setError(t.discussions.errors.participantsRequired)
      return
    }

    const discussion = create(
      { title: title.trim(), employeeIds: selectedIds },
      {
        ownerName: t.discussions.ownerName,
        systemStarted: (names) => t.discussions.systemStarted.replace('{names}', names),
      },
    )
    navigate(`/ops/discussions/${discussion.id}`)
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.discussions.newDiscussion} description={t.discussions.newDescription} />
        <Link to="/ops/discussions" className="mcBtn mcBtnSecondary">
          {t.employeeBuilder.cancel}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mcStack">
        <Panel title={t.discussions.newFormTitle}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.labels.title}</span>
              <input
                className="mcInput"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t.discussions.titlePlaceholder}
              />
            </label>

            <div className="mcField">
              <span className="mcFieldLabel">{t.discussions.selectParticipants}</span>
              <p className="mcFormHint">{t.discussions.selectParticipantsHint}</p>
              <div className="mcDiscussionRosterGrid">
                {roster.map((entry) => (
                  <label key={entry.id} className="mcDiscussionRosterCard">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(entry.id)}
                      onChange={() => setSelectedIds(toggleItem(selectedIds, entry.id))}
                    />
                    <span className="mcDiscussionRosterName">{entry.codename}</span>
                    <span className="mcDiscussionRosterRole">{entry.role}</span>
                    <span className="mcDiscussionRosterSource mcMono">
                      {entry.source === 'custom' ? t.discussions.sourceCustom : t.discussions.sourceBuiltin}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {error ? <div className="mcFormError">{error}</div> : null}

        <div className="mcFormActions">
          <Link to="/ops/discussions" className="mcBtn mcBtnSecondary">
            {t.employeeBuilder.cancel}
          </Link>
          <button type="submit" className="mcBtn mcBtnPrimary">
            {t.discussions.createDiscussion}
          </button>
        </div>
      </form>
    </>
  )
}
