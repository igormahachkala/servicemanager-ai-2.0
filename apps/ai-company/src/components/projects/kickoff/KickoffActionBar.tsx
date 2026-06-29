import { Link } from 'react-router-dom'
import type { AiPhotoLabKickoffSnapshot, KickoffTaskPreset } from '../../../domain/projects/aiPhotoLabKickoff'
import { Panel } from '../../../mission-control/components/ui'
import { useI18n } from '../../../i18n'

type Props = {
  snapshot: AiPhotoLabKickoffSnapshot
  runningPresetId: KickoffTaskPreset['id'] | null
  error: string | null
  onStartPreset: (id: KickoffTaskPreset['id']) => void
}

export function KickoffActionBar(props: Props) {
  const { t } = useI18n()

  return (
    <Panel title={t.photoLabKickoff.sections.actions}>
      <div className="acKickoffPanelBody">
        <p className="acMuted">{t.photoLabKickoff.actionsHint}</p>
        <div className="acKickoffActionGrid">
          {props.snapshot.taskPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="mcBtn mcBtnPrimary"
              disabled={props.runningPresetId !== null}
              onClick={() => props.onStartPreset(preset.id)}
            >
              {props.runningPresetId === preset.id
                ? t.photoLabKickoff.actions.starting
                : t.photoLabKickoff.actions[preset.labelKey]}
            </button>
          ))}
        </div>

        <div className="acKickoffSecondaryActions">
          <Link to={props.snapshot.links.handoff} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.photoLabKickoff.actions.openCodexHandoff}
          </Link>
          <Link to={props.snapshot.links.demoChecklistAnchor} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.photoLabKickoff.actions.openDemoChecklist}
          </Link>
          <Link to={props.snapshot.links.liveRuntime} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.photoLabKickoff.actions.openLiveRuntime}
          </Link>
          <Link to={props.snapshot.links.visualLab} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.photoLabKickoff.actions.openVisualLab}
          </Link>
          <Link to={props.snapshot.links.runTask} className="mcBtn mcBtnSecondary mcBtnSmall">
            {t.photoLabKickoff.actions.openRunTask}
          </Link>
        </div>

        {props.error ? <p className="mcRuntimeExecutionError">{props.error}</p> : null}
      </div>
    </Panel>
  )
}
