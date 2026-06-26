import { Link } from 'react-router-dom'
import { KnowledgeAssignments } from '../knowledge/KnowledgeAssignments'
import type { EmployeeWorkspaceSnapshot } from '../../hooks/useEmployeeWorkspace'
import { Panel } from '../../mission-control/components/ui'
import { useI18n } from '../../i18n'

export function AssignedKnowledge({ snapshot }: { snapshot: EmployeeWorkspaceSnapshot }) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.employeeWorkspace.sections.knowledge}
      right={
        <Link to="/ops/knowledge" className="mcBtn mcBtnSecondary mcBtnSm">
          {t.employeeWorkspace.openKnowledge}
        </Link>
      }
    >
      <div className="mcProfilePanelBody">
        {snapshot.knowledgeAssignments.length === 0 ? (
          <p className="mcMuted">{t.employeeWorkspace.empty.knowledge}</p>
        ) : (
          <KnowledgeAssignments assignments={snapshot.knowledgeAssignments} />
        )}
      </div>
    </Panel>
  )
}
