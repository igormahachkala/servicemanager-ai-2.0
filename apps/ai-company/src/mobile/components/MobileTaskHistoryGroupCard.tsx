import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import type { MobileTaskHistoryGroupView } from '../history/mobileTaskHistoryViewModel'
import { MOBILE_PATHS, mobileTaskHistoryGroupHref } from '../navigation/mobileHrefResolver'

type Props = {
  group: MobileTaskHistoryGroupView
  expanded?: boolean
}

export function MobileTaskHistoryGroupCard({ group, expanded = false }: Props) {
  const { t } = useI18n()
  const copy = t.mobile.taskHistory

  if (group.totalCount === 0) {
    return (
      <article className="acMobileTaskHistoryGroupCard acMobileTaskHistoryGroupCardEmpty">
        <h3 className="acMobileTaskHistoryGroupTitle">{copy.groups[group.id]}</h3>
        <p className="acMobileTaskHistoryGroupEmpty">{copy.emptyGroup}</p>
      </article>
    )
  }

  return (
    <article
      className={`acMobileTaskHistoryGroupCard${expanded ? ' acMobileTaskHistoryGroupCardExpanded' : ''}`}
    >
      <div className="acMobileTaskHistoryGroupHead">
        <h3 className="acMobileTaskHistoryGroupTitle">{copy.groups[group.id]}</h3>
        <span className="acMobileTaskHistoryGroupCount">{group.totalCount}</span>
      </div>

      <dl className="acMobileTaskHistoryGroupStats">
        <div className="acMobileTaskHistoryGroupStat">
          <dt>{copy.stats.completed}</dt>
          <dd>{group.completedCount}</dd>
        </div>
        <div className="acMobileTaskHistoryGroupStat">
          <dt>{copy.stats.errors}</dt>
          <dd>{group.errorCount}</dd>
        </div>
        <div className="acMobileTaskHistoryGroupStat acMobileTaskHistoryGroupStatWide">
          <dt>{copy.stats.lastReport}</dt>
          <dd>
            {group.lastReportHref ? (
              <Link to={group.lastReportHref} className="acMobileLinkBtn">
                {group.lastReportTitle ?? copy.actions.openReport}
              </Link>
            ) : (
              copy.stats.noReport
            )}
          </dd>
        </div>
      </dl>

      {group.recentItems.length > 0 ? (
        <ul className="acMobileTaskHistoryRecentList">
          {group.recentItems.map((item) => (
            <li key={item.id} className="acMobileTaskHistoryRecentItem">
              <span className="acMobileTaskHistoryRecentTitle">{item.title}</span>
              <span className="acMobileTaskHistoryRecentMeta">
                {item.employeeLabel} · {copy.status[item.statusLabelKey]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Link
        to={expanded ? MOBILE_PATHS.tasksHistory : mobileTaskHistoryGroupHref(group.id)}
        className={
          expanded
            ? 'acMobileSecondaryBtn acMobileTaskHistoryGroupAction'
            : 'acMobilePrimaryBtn acMobileTaskHistoryGroupAction'
        }
      >
        {expanded ? copy.actions.showAllGroups : copy.actions.openGroup}
      </Link>
    </article>
  )
}
