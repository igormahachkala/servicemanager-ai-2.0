import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { useI18n } from '../../i18n'

export function EmployeeActivity() {
  const { t } = useI18n()

  const blocks = [
    {
      title: t.employeeProfile.future.activityFeed,
      description: t.employeeProfile.future.activityFeedDesc,
    },
    {
      title: t.employeeProfile.future.runHistory,
      description: t.employeeProfile.future.runHistoryDesc,
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
      <Panel title={t.employeeProfile.sections.activity}>
        <div className="mcProfilePanelBody mcProfileFutureGrid">
          {blocks.map((block) => (
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
