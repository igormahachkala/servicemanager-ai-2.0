import { Link } from 'react-router-dom'
import {
  KickoffActionBar,
  KickoffCtoPlanPanel,
  KickoffDemoReadinessPanel,
  KickoffHeaderLinks,
  KickoffMaxHandoffPanel,
  KickoffOwnerApprovalsPanel,
  KickoffQaChecklistPanel,
  KickoffSprintPanel,
  KickoffTeamActivityPanel,
} from '../components/projects/kickoff'
import { useAiPhotoLabKickoff } from '../hooks/useAiPhotoLabKickoff'
import { PageHeader } from '../mission-control/components/ui'
import { useI18n } from '../i18n'

export function AiPhotoLabKickoffPage() {
  const { t } = useI18n()
  const { snapshot, stats, runningPresetId, error, runPreset } = useAiPhotoLabKickoff()

  if (!snapshot) {
    return (
      <>
        <PageHeader
          title={t.photoLabKickoff.notFoundTitle}
          description={t.photoLabKickoff.notFoundDescription}
        />
        <Link to="/ops/projects" className="mcBtn mcBtnSecondary">
          {t.projects.backToList}
        </Link>
      </>
    )
  }

  return (
    <div className="acKickoffPage">
      <div className="mcPageHeaderRow">
        <PageHeader title={t.photoLabKickoff.title} description={t.photoLabKickoff.pageDescription} />
        <KickoffHeaderLinks links={snapshot.links} />
      </div>

      <div className="acKickoffStats">
        <div className="acKickoffStat">
          <span className="acKickoffStatValue">
            {stats.demoReady}/{stats.demoTotal}
          </span>
          <span className="acKickoffStatLabel">{t.photoLabKickoff.stats.demoReady}</span>
        </div>
        <div className="acKickoffStat">
          <span className="acKickoffStatValue">{stats.pendingDecisions}</span>
          <span className="acKickoffStatLabel">{t.photoLabKickoff.stats.decisions}</span>
        </div>
        <div className="acKickoffStat">
          <span className="acKickoffStatValue">{stats.pendingApprovals}</span>
          <span className="acKickoffStatLabel">{t.photoLabKickoff.stats.approvals}</span>
        </div>
        <div className="acKickoffStat">
          <span className="acKickoffStatValue">{snapshot.controlRoom.progress}%</span>
          <span className="acKickoffStatLabel">{t.photoLabKickoff.stats.progress}</span>
        </div>
      </div>

      <KickoffActionBar
        snapshot={snapshot}
        runningPresetId={runningPresetId}
        error={error}
        onStartPreset={(id) => void runPreset(id).catch(() => undefined)}
      />

      <div className="acKickoffGrid">
        <div className="acKickoffMain">
          <KickoffSprintPanel snapshot={snapshot} />
          <KickoffDemoReadinessPanel snapshot={snapshot} />
          <KickoffCtoPlanPanel snapshot={snapshot} />
          <KickoffMaxHandoffPanel snapshot={snapshot} />
        </div>
        <div className="acKickoffSide">
          <KickoffTeamActivityPanel snapshot={snapshot} />
          <KickoffOwnerApprovalsPanel snapshot={snapshot} />
          <KickoffQaChecklistPanel snapshot={snapshot} />
        </div>
      </div>

      <p className="mcMemoryLocalNote">{t.photoLabKickoff.localNote}</p>
    </div>
  )
}
