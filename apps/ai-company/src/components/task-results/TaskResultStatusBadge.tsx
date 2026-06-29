import type { TaskResultStatus } from '../../domain/taskResults'
import { useI18n } from '../../i18n'

const STATUS_CLASS: Record<TaskResultStatus, string> = {
  draft: 'acTaskResultStatusDraft',
  ready_for_review: 'acTaskResultStatusReady_for_review',
  approved: 'acTaskResultStatusApproved',
  changes_requested: 'acTaskResultStatusChanges_requested',
  rejected: 'acTaskResultStatusRejected',
  archived: 'acTaskResultStatusArchived',
}

type Props = {
  status: TaskResultStatus
}

export function TaskResultStatusBadge({ status }: Props) {
  const { t } = useI18n()
  return (
    <span className={`acTaskResultStatusBadge ${STATUS_CLASS[status]}`}>
      {t.taskResultEngine.statuses[status]}
    </span>
  )
}
