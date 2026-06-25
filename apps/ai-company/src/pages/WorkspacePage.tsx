import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../mission-control/components/ui'
import { WorkspaceHeader } from '../components/workspaces/WorkspaceHeader'
import { WorkspaceOverview } from '../components/workspaces/WorkspaceOverview'
import { WorkspaceAssignments } from '../components/workspaces/WorkspaceAssignments'
import { WorkspaceKnowledge } from '../components/workspaces/WorkspaceKnowledge'
import { WorkspaceDocuments } from '../components/workspaces/WorkspaceDocuments'
import { WorkspaceActivity } from '../components/workspaces/WorkspaceActivity'
import { WorkspaceTools } from '../components/workspaces/WorkspaceTools'
import { WorkspaceSettings } from '../components/workspaces/WorkspaceSettings'
import { WorkspaceEmptyState } from '../components/workspaces/WorkspaceEmptyState'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { useAssignments } from '../hooks/useAssignments'
import { setActiveWorkspaceId } from '../hooks/useActiveWorkspace'
import { useI18n } from '../i18n'

type WorkspaceSection =
  | 'overview'
  | 'employees'
  | 'knowledge'
  | 'documents'
  | 'activity'
  | 'tools'
  | 'settings'

export function WorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const { workspaces } = useWorkspaces()
  const { byWorkspace } = useAssignments()
  const [section, setSection] = useState<WorkspaceSection>('overview')

  const workspace = useMemo(
    () => workspaces.find((item) => item.id === id) ?? null,
    [workspaces, id],
  )

  useEffect(() => {
    if (workspace) {
      setActiveWorkspaceId(workspace.id)
    }
  }, [workspace])

  const sections: WorkspaceSection[] = [
    'overview',
    'employees',
    'knowledge',
    'documents',
    'activity',
    'tools',
    'settings',
  ]

  if (!workspace) {
    return (
      <>
        <PageHeader
          title={t.workspaces.notFoundTitle}
          description={t.workspaces.notFoundDescription}
        />
        <WorkspaceEmptyState
          title={t.workspaces.notFoundTitle}
          description={t.workspaces.notFoundDescription}
          action={
            <Link to="/ops/workspaces" className="mcBtn mcBtnPrimary">
              {t.workspaces.backToList}
            </Link>
          }
        />
      </>
    )
  }

  const assignmentCount = byWorkspace(workspace.id).length

  return (
    <div className="mcWorkspacePage">
      <WorkspaceHeader workspace={workspace} />

      <nav className="mcProfileNav" aria-label={t.workspaces.navLabel}>
        {sections.map((key) => (
          <button
            key={key}
            type="button"
            className={section === key ? 'mcProfileNavItem mcProfileNavItemActive' : 'mcProfileNavItem'}
            onClick={() => setSection(key)}
          >
            {t.workspaces.tabs[key]}
          </button>
        ))}
      </nav>

      <div className="mcProfileContent">
        {section === 'overview' ? (
          <WorkspaceOverview workspace={workspace} assignmentCount={assignmentCount} />
        ) : null}
        {section === 'employees' ? <WorkspaceAssignments workspaceId={workspace.id} /> : null}
        {section === 'knowledge' ? <WorkspaceKnowledge /> : null}
        {section === 'documents' ? <WorkspaceDocuments /> : null}
        {section === 'activity' ? <WorkspaceActivity /> : null}
        {section === 'tools' ? <WorkspaceTools /> : null}
        {section === 'settings' ? (
          <WorkspaceSettings key={workspace.updatedAt} workspace={workspace} />
        ) : null}
      </div>
    </div>
  )
}
