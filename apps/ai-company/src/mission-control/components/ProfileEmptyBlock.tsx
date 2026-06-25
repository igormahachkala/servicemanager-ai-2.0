import { useI18n } from '../../i18n'

export function ProfileEmptyBlock(props: {
  title: string
  description: string
  badge?: string
}) {
  const { t } = useI18n()

  return (
    <div className="mcProfileEmpty">
      {props.badge ? <span className="mcProfileFutureBadge">{props.badge}</span> : null}
      <div className="mcProfileEmptyTitle">{props.title}</div>
      <p className="mcProfileEmptyDesc">{props.description}</p>
      <span className="mcProfileEmptyHint">{t.employeeProfile.comingSoon}</span>
    </div>
  )
}
