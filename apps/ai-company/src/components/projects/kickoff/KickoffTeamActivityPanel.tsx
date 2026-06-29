import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import {
  resolveLivingActivityFromExecution,
  resolveLivingActivityFromTask,
} from '../../../domain/living'
import { LivingActivityLine } from '../../living'
import { Card } from '../../layout'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
}

export function KickoffTeamActivityPanel({ snapshot }: Props) {
  const { t } = useI18n()
  const { workNow } = snapshot.controlRoom
  const rows = [
    ...workNow.currentlyWorking.map((item) => ({ kind: 'working' as const, ...item })),
    ...workNow.waitingApproval.map((item) => ({ kind: 'waiting' as const, ...item })),
  ].slice(0, 6)

  return (
    <Card title={t.photoLabKickoff.sections.teamActivity}>
      {rows.length === 0 ? (
        <div className="acMuted">{t.livingCompany.noRecentActivity}</div>
      ) : (
        <div className="acKickoffTeamActivity">
          {rows.map(({ task, execution, kind }) => {
            const living = execution
              ? resolveLivingActivityFromExecution(execution)
              : resolveLivingActivityFromTask(task)
            const adjusted =
              kind === 'waiting' ? { ...living, phase: 'waiting' as const } : living
            const member = snapshot.controlRoom.team.find((item) => item.id === task.assigneeId)

            return (
              <div key={task.id} className="acKickoffTeamRow">
                <div className="acKickoffTeamMeta">
                  <strong>{member?.codename ?? task.assigneeId}</strong>
                  <span className="acMuted">{member?.role}</span>
                </div>
                <LivingActivityLine snapshot={adjusted} compact showProgress={adjusted.progress !== null} />
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
