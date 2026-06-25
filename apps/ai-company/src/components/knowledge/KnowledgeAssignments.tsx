import { Link } from 'react-router-dom'
import type { KnowledgeAssignment } from '../../domain/knowledge/knowledgeAssignment'
import { getCollectionById, getKnowledgeById } from '../../domain/knowledge/knowledgeStorage'
import { useI18n } from '../../i18n'

function statusClass(status: KnowledgeAssignment['status']): string {
  if (status === 'completed') return 'mcKnowledgeAssignCompleted'
  if (status === 'in_progress') return 'mcKnowledgeAssignProgress'
  return 'mcKnowledgeAssignAssigned'
}

export function KnowledgeAssignments({ assignments }: { assignments: KnowledgeAssignment[] }) {
  const { t } = useI18n()

  if (assignments.length === 0) {
    return (
      <div className="mcKnowledgeEmptyInline mcMuted">{t.knowledgeEngine.emptyAssignments}</div>
    )
  }

  return (
    <div className="mcKnowledgeAssignmentList">
      {assignments.map((assignment) => {
        const knowledge = assignment.knowledgeId
          ? getKnowledgeById(assignment.knowledgeId)
          : null
        const collection = assignment.collectionId
          ? getCollectionById(assignment.collectionId)
          : null
        const targetTitle = knowledge?.title ?? collection?.title ?? t.common.empty

        return (
          <div key={assignment.id} className="mcKnowledgeAssignmentRow">
            <div className="mcKnowledgeAssignmentHead">
              <span className={`mcKnowledgeAssignBadge ${statusClass(assignment.status)}`}>
                {t.knowledgeEngine.assignmentStatuses[assignment.status]}
              </span>
              <span className="mcKnowledgeAssignmentTarget">{targetTitle}</span>
            </div>
            {assignment.note ? (
              <p className="mcKnowledgeAssignmentNote mcMuted">{assignment.note}</p>
            ) : null}
            <div className="mcKnowledgeAssignmentLinks">
              {knowledge ? (
                <Link to={`/ops/knowledge/${knowledge.id}`} className="mcBtn mcBtnSecondary mcBtnSmall">
                  {t.knowledgeEngine.openItem}
                </Link>
              ) : null}
              {collection ? (
                <Link to="/ops/knowledge/collections" className="mcBtn mcBtnSecondary mcBtnSmall">
                  {t.knowledgeEngine.openCollection}
                </Link>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
