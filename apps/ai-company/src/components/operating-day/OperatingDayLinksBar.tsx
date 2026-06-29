import { Link } from 'react-router-dom'
import { AI_PHOTO_LAB_CONTROL_ROOM_PATH } from '../../domain/projects/aiPhotoLabControlRoom'
import { AI_PHOTO_LAB_KICKOFF_PATH } from '../../domain/projects/aiPhotoLabKickoff'
import { AI_PHOTO_LAB_WORKSPACE_ID } from '../../domain/projects/aiPhotoLabIds'
import { useI18n } from '../../i18n'

const LINKS = [
  { key: 'commandCenter' as const, to: '/ops' },
  { key: 'runtime' as const, to: '/ops/runtime' },
  { key: 'kickoff' as const, to: AI_PHOTO_LAB_KICKOFF_PATH },
  { key: 'controlRoom' as const, to: AI_PHOTO_LAB_CONTROL_ROOM_PATH },
  { key: 'taskResults' as const, to: '/ops/task-results' },
  { key: 'timeline' as const, to: '/ops/timeline' },
  { key: 'workspace' as const, to: `/ops/workspaces/${encodeURIComponent(AI_PHOTO_LAB_WORKSPACE_ID)}` },
] as const

export function OperatingDayLinksBar() {
  const { t } = useI18n()

  return (
    <nav className="acOperatingDayLinks" aria-label={t.operatingDayEngine.linksAria}>
      {LINKS.map((link) => (
        <Link key={link.key} to={link.to} className="acOperatingDayLink">
          {t.operatingDayEngine.links[link.key]}
        </Link>
      ))}
    </nav>
  )
}
