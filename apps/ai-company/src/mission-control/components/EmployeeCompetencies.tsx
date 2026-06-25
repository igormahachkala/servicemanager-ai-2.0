import { Link } from 'react-router-dom'
import { Panel } from './ui'
import { CompetencyOverview } from '../../components/competencies/CompetencyOverview'
import { CompetencyStatsPanel } from '../../components/competencies/CompetencyStats'
import type { CustomEmployee } from '../data/customEmployees'
import { useCompetencies } from '../../hooks/useCompetencies'
import { useReputation } from '../../hooks/useReputation'
import { useI18n } from '../../i18n'

export function EmployeeCompetencies({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()
  const { skills, competencies, certifications, learningPath, stats } = useCompetencies(employee.id)
  const { reputation } = useReputation(employee.id)

  return (
    <div className="mcStack">
      <CompetencyOverview stats={stats} reputation={reputation} />
      <CompetencyStatsPanel stats={stats} competencies={competencies} />

      <Panel title={t.competencyEngine.sections.competencies}>
        <div className="mcProfilePanelBody">
          {competencies.length === 0 ? (
            <div className="mcCompetencyEmpty">{t.competencyEngine.empty.competencies}</div>
          ) : (
            <div className="mcCompetencyDomainList">
              {competencies.map((item) => (
                <div key={item.domain} className="mcCompetencyDomainRow">
                  <span className="mcCompetencyDomainName">{item.domain}</span>
                  <div className="mcCompetencyLevelBar">
                    <span
                      className="mcCompetencyLevelFill mcCompetencyLevelFillAccent"
                      style={{ width: `${item.score}%` }}
                    />
                    <span className="mcCompetencyLevelText mcMono">{item.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <div className="mcCompetencyInlineSummary mcMono mcMuted">
        {skills.length} skills · {certifications.length} certs · {learningPath.completedSkills.length}{' '}
        completed · trust {reputation?.trustScore ?? 0}
      </div>

      <div className="mcFormActions">
        <Link
          to={`/ops/employees/${employee.id}/competencies`}
          className="mcBtn mcBtnPrimary mcBtnSmall"
        >
          {t.competencyEngine.openCompetencies}
        </Link>
      </div>
    </div>
  )
}
