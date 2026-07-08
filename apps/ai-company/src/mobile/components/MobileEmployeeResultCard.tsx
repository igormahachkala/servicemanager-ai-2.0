import { Link } from 'react-router-dom'
import type { OwnerHomeCompletedTask } from '../../domain/ownerHome'
import { useI18n } from '../../i18n'

type MobileEmployeeResultCardProps = {
  task: OwnerHomeCompletedTask
}

function formatCompletedTime(iso: string): string | null {
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MobileEmployeeResultCard({ task }: MobileEmployeeResultCardProps) {
  const { t } = useI18n()
  const time = formatCompletedTime(task.completedAt)

  return (
    <article className="acMobileEmployeeResultCard">
      <div className="acMobileEmployeeResultMain">
        <h3 className="acMobileEmployeeResultTitle">{task.title}</h3>
        <p className="acMobileEmployeeResultMeta">
          <span>{task.employeeLabel}</span>
          {time ? (
            <>
              <span className="acMobileEmployeeResultSep">·</span>
              <span>{time}</span>
            </>
          ) : null}
        </p>
        {task.reportTitle ? (
          <p className="acMobileEmployeeResultReport">{task.reportTitle}</p>
        ) : null}
      </div>
      {task.reportHref ? (
        <Link to={task.reportHref} className="acMobileLinkBtn">
          {t.ownerHome.actions.openReport}
        </Link>
      ) : null}
    </article>
  )
}
