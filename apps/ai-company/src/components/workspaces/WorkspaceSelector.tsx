import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace'
import { useI18n } from '../../i18n'

export function WorkspaceSelector() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeId, activeWorkspace, setActive, workspaces } = useActiveWorkspace()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const match = location.pathname.match(/^\/ops\/workspaces\/([^/]+)$/)
    if (match && match[1] !== 'new' && match[1] !== activeId) {
      setActive(match[1])
    }
  }, [location.pathname, activeId, setActive])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const label = activeWorkspace?.name ?? t.workspaces.selector.none

  return (
    <div className="acWorkspaceSelector" ref={rootRef}>
      <button
        type="button"
        className="acWorkspaceSelectorBtn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="acWorkspaceSelectorLabel">{t.workspaces.selector.label}</span>
        <span className="acWorkspaceSelectorValue">{label}</span>
        <span className="acWorkspaceSelectorChevron" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="acWorkspaceSelectorMenu" role="listbox">
          {workspaces.length === 0 ? (
            <div className="acWorkspaceSelectorEmpty">{t.workspaces.selector.empty}</div>
          ) : (
            workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                role="option"
                aria-selected={workspace.id === activeId}
                className={
                  workspace.id === activeId
                    ? 'acWorkspaceSelectorItem acWorkspaceSelectorItemActive'
                    : 'acWorkspaceSelectorItem'
                }
                onClick={() => {
                  setActive(workspace.id)
                  setOpen(false)
                  navigate(`/ops/workspaces/${workspace.id}`)
                }}
              >
                <span className="acWorkspaceSelectorItemName">{workspace.name}</span>
                <span className="acWorkspaceSelectorItemMeta mcMono mcMuted">
                  {t.workspaces.type[workspace.type]}
                </span>
              </button>
            ))
          )}
          <div className="acWorkspaceSelectorFooter">
            <Link to="/ops/workspaces" className="acWorkspaceSelectorLink" onClick={() => setOpen(false)}>
              {t.workspaces.selector.manage}
            </Link>
            <Link
              to="/ops/workspaces/new"
              className="acWorkspaceSelectorLink"
              onClick={() => setOpen(false)}
            >
              {t.workspaces.newWorkspace}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
