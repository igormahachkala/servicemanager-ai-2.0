import { Panel } from '../../mission-control/components/ui'
import { KnowledgeAssignments } from '../knowledge/KnowledgeAssignments'
import { useKnowledge } from '../../hooks/useKnowledge'
import { useI18n } from '../../i18n'

export function EmployeeAssignedKnowledge({ employeeId }: { employeeId: string }) {
  const { t } = useI18n()
  const { getAssignmentsForEmployee } = useKnowledge()
  const assignments = getAssignmentsForEmployee(employeeId)

  return (
    <Panel title={t.knowledgeEngine.assignedKnowledgeTitle}>
      <div className="mcProfilePanelBody">
        <p className="mcMuted">{t.knowledgeEngine.assignedKnowledgeDescription}</p>
        <KnowledgeAssignments assignments={assignments} />
      </div>
    </Panel>
  )
}
