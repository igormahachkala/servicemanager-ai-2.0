import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { EmployeeRunHistory } from '../../components/run/EmployeeRunHistory'
import { useI18n } from '../../i18n'

export function EmployeeActivity({ employeeId }: { employeeId?: string }) {
  const { t } = useI18n()

  const futureBlocks = [
    {
      title: t.employeeProfile.future.activityFeed,
      description: t.employeeProfile.future.activityFeedDesc,
    },
    {
      title: t.employeeProfile.future.conversation,
      description: t.employeeProfile.future.conversationDesc,
    },
    {
      title: t.employeeProfile.future.discussion,
      description: t.employeeProfile.future.discussionDesc,
    },
  ]

  return (
    <div className="mcStack">
      {employeeId ? <EmployeeRunHistory employeeId={employeeId} /> : null}

      <Panel title={t.employeeProfile.sections.activity}>
        <div className="mcProfilePanelBody mcProfileFutureGrid">
          {futureBlocks.map((block) => (
            <ProfileEmptyBlock
              key={block.title}
              badge={t.employeeProfile.futureBadge}
              title={block.title}
              description={block.description}
            />
          ))}
        </div>
      </Panel>
    </div>
  )
}
