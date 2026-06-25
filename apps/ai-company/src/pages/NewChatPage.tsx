import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, Panel } from '../mission-control/components/ui'
import { CHAT_TYPES, type ChatType } from '../domain/chats/chatTypes'
import { getDiscussionRoster } from '../domain/chats/chatStorage'
import { useChats } from '../hooks/useChats'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useI18n } from '../i18n'

function toggleItem(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item]
}

export function NewChatPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { createDirect, createGroup, createWorkspace } = useChats()
  const { workspaces } = useWorkspaces()
  const roster = useMemo(() => getDiscussionRoster(), [])

  const [type, setType] = useState<ChatType>('direct')
  const [title, setTitle] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (type === 'direct') {
      if (!employeeId) {
        setError(t.chats.errors.employeeRequired)
        return
      }
      const entry = roster.find((item) => item.id === employeeId)
      if (!entry) {
        setError(t.chats.errors.employeeRequired)
        return
      }
      const chat = createDirect({
        employeeId: entry.id,
        employeeDisplayName: entry.codename,
        employeeRole: entry.role,
        ownerName: t.chats.ownerName,
        systemWelcome: t.chats.systemWelcomeDirect.replace('{name}', entry.codename),
      })
      navigate(`/ops/chats/${encodeURIComponent(chat.id)}`)
      return
    }

    if (type === 'group') {
      if (!title.trim()) {
        setError(t.chats.errors.titleRequired)
        return
      }
      if (selectedIds.length === 0) {
        setError(t.chats.errors.participantsRequired)
        return
      }
      const employees = selectedIds
        .map((id) => roster.find((item) => item.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => ({ id: item.id, displayName: item.codename, role: item.role }))

      const names = employees.map((item) => item.displayName).join(', ')
      const chat = createGroup({
        title: title.trim(),
        employeeIds: employees,
        ownerName: t.chats.ownerName,
        systemStarted: t.chats.systemStartedGroup.replace('{names}', names),
      })
      navigate(`/ops/chats/${encodeURIComponent(chat.id)}`)
      return
    }

    if (type === 'workspace') {
      if (!workspaceId) {
        setError(t.chats.errors.workspaceRequired)
        return
      }
      const workspace = workspaces.find((item) => item.id === workspaceId)
      if (!workspace) {
        setError(t.chats.errors.workspaceRequired)
        return
      }
      const chat = createWorkspace({
        workspaceId: workspace.id,
        workspaceTitle: workspace.name,
        ownerName: t.chats.ownerName,
        systemStarted: t.chats.systemStartedWorkspace.replace('{name}', workspace.name),
      })
      navigate(`/ops/chats/${encodeURIComponent(chat.id)}`)
      return
    }

    navigate('/ops/chats/sys%3Aplatform')
  }

  return (
    <>
      <div className="mcPageHeaderRow">
        <PageHeader title={t.chats.newChat} description={t.chats.newDescription} />
        <Link to="/ops/chats" className="mcBtn mcBtnSecondary">
          {t.employeeBuilder.cancel}
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mcStack">
        <Panel title={t.chats.newFormTitle}>
          <div className="mcFormBody">
            <label className="mcField">
              <span className="mcFieldLabel">{t.chats.typeLabel}</span>
              <select
                className="mcInput"
                value={type}
                onChange={(event) => setType(event.target.value as ChatType)}
              >
                {CHAT_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {t.chats.types[option]}
                  </option>
                ))}
              </select>
            </label>

            {type === 'direct' ? (
              <label className="mcField">
                <span className="mcFieldLabel">{t.chats.selectEmployee}</span>
                <select
                  className="mcInput"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                >
                  <option value="">{t.chats.chooseEmployee}</option>
                  {roster.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.codename} — {entry.role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {type === 'group' ? (
              <>
                <label className="mcField">
                  <span className="mcFieldLabel">{t.labels.title}</span>
                  <input
                    className="mcInput"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t.chats.titlePlaceholder}
                  />
                </label>
                <div className="mcField">
                  <span className="mcFieldLabel">{t.chats.selectParticipants}</span>
                  <p className="mcFormHint">{t.chats.selectParticipantsHint}</p>
                  <div className="mcChatRosterGrid">
                    {roster.map((entry) => (
                      <label key={entry.id} className="mcChatRosterCard">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(entry.id)}
                          onChange={() => setSelectedIds(toggleItem(selectedIds, entry.id))}
                        />
                        <span className="mcChatRosterName">{entry.codename}</span>
                        <span className="mcChatRosterRole">{entry.role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {type === 'workspace' ? (
              <label className="mcField">
                <span className="mcFieldLabel">{t.chats.selectWorkspace}</span>
                <select
                  className="mcInput"
                  value={workspaceId}
                  onChange={(event) => setWorkspaceId(event.target.value)}
                >
                  <option value="">{t.chats.chooseWorkspace}</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {type === 'system' ? (
              <p className="mcFormHint">{t.chats.systemChannelHint}</p>
            ) : null}
          </div>
        </Panel>

        {error ? <div className="mcFormError">{error}</div> : null}

        <div className="mcFormActions">
          <Link to="/ops/chats" className="mcBtn mcBtnSecondary">
            {t.employeeBuilder.cancel}
          </Link>
          <button type="submit" className="mcBtn mcBtnPrimary">
            {type === 'system' ? t.chats.openSystemChannel : t.chats.createChat}
          </button>
        </div>
      </form>
    </>
  )
}
