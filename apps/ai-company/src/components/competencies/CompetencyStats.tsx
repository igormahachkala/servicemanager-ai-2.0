import type { Competency } from '../../domain/competencies/competency'
import type { CompetencyStats } from '../../domain/competencies/competencyStorage'
import { useI18n } from '../../i18n'

export function CompetencyStatsPanel(props: {
  stats: CompetencyStats | null
  competencies: Competency[]
}) {
  const { t } = useI18n()

  if (!props.stats) return null

  return (
    <div className="mcCompetencyStatsGrid">
      <div className="mcCompetencyStatCard">
        <div className="mcCompetencyStatLabel">{t.competencyEngine.stats.skills}</div>
        <div className="mcCompetencyStatValue">{props.stats.skillCount}</div>
        <div className="mcCompetencyStatHint mcMono mcMuted">
          {props.stats.verifiedSkills} {t.competencyEngine.stats.verified}
        </div>
      </div>
      <div className="mcCompetencyStatCard">
        <div className="mcCompetencyStatLabel">{t.competencyEngine.stats.certificates}</div>
        <div className="mcCompetencyStatValue">{props.stats.certificationCount}</div>
      </div>
      <div className="mcCompetencyStatCard">
        <div className="mcCompetencyStatLabel">{t.competencyEngine.stats.experience}</div>
        <div className="mcCompetencyStatValue">{props.stats.experienceCount}</div>
      </div>
      <div className="mcCompetencyStatCard">
        <div className="mcCompetencyStatLabel">{t.competencyEngine.stats.domains}</div>
        <div className="mcCompetencyStatValue">{props.competencies.length}</div>
      </div>
    </div>
  )
}
