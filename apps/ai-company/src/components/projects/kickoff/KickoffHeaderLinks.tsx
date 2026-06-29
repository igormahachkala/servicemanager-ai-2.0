import { Link } from 'react-router-dom'
import type { AiPhotoLabKickoffSnapshot } from '../../../domain/projects/aiPhotoLabKickoff'
import { useI18n } from '../../../i18n'

export function KickoffHeaderLinks(props: { links: AiPhotoLabKickoffSnapshot['links'] }) {
  const { t } = useI18n()

  return (
    <div className="acKickoffHeaderLinks">
      <Link to={props.links.controlRoom} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.photoLabKickoff.links.controlRoom}
      </Link>
      <Link to={props.links.sprint} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.pages.sprint}
      </Link>
      <Link to={props.links.runTask} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.pages.runTask}
      </Link>
      <Link to={props.links.liveRuntime} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.pages.runtimeLive}
      </Link>
      <Link to={props.links.visualLab} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.pages.visualLab}
      </Link>
      <Link to={props.links.timeline} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.pages.companyTimeline}
      </Link>
      <Link to={props.links.notifications} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.pages.notifications}
      </Link>
      <Link to={props.links.commandCenter} className="mcBtn mcBtnSecondary mcBtnSmall">
        {t.commandCenter.title}
      </Link>
    </div>
  )
}
