import { Link } from 'react-router-dom'
import {
  formatBuilderToolExecutionStatusLabel,
  getBuilderToolDecisionById,
  listBuilderToolExecutionRunsForEmployee,
  type BuilderToolExecutionRun,
} from '../../domain/builderToolDecision'
import { BUILDER_EMPLOYEE_ID } from '../../domain/mobileEmployee'
import { useI18n } from '../../i18n'
import { MOBILE_PATHS } from '../navigation/mobileHrefResolver'
import { MobileCard } from './MobileCard'

type Props = {
  employeeId: string
}

function pickLatestRun(runs: BuilderToolExecutionRun[]): BuilderToolExecutionRun | null {
  return runs[0] ?? null
}

export function MobileBuilderToolStatusCard({ employeeId }: Props) {
  const { t } = useI18n()
  if (employeeId !== BUILDER_EMPLOYEE_ID) return null

  const copy = t.mobile.employeeProfiles.builder.toolStatus
  const run = pickLatestRun(listBuilderToolExecutionRunsForEmployee(BUILDER_EMPLOYEE_ID))
  if (!run) return null

  const decision = getBuilderToolDecisionById(run.builderToolDecisionId)
  const statusLabel = formatBuilderToolExecutionStatusLabel(run.status)
  const tone =
    run.status === 'awaiting_owner'
      ? 'warning'
      : run.status === 'rejected'
        ? 'error'
        : 'success'

  return (
    <MobileCard title={copy.title} description={copy.description}>
      <div className={`acMobileBuilderToolStatus acMobileBuilderToolStatus--${tone}`}>
        <p className="acMobileBuilderToolStatusEyebrow">{copy.toolLabel}</p>
        <p className="acMobileBuilderToolStatusTitle">{run.taskTitle}</p>
        <p className="acMobileBuilderToolStatusState">{statusLabel}</p>
        {decision?.reason ? (
          <p className="acMobileBuilderToolStatusReason">{decision.reason}</p>
        ) : null}
        {run.status === 'awaiting_owner' ? (
          <Link to={MOBILE_PATHS.decisions} className="acMobilePrimaryBtn">
            {copy.openDecisions}
          </Link>
        ) : null}
      </div>
    </MobileCard>
  )
}
