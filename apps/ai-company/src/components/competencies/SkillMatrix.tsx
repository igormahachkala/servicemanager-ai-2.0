import { Panel } from '../../mission-control/components/ui'
import type { Skill } from '../../domain/competencies/skill'
import { useI18n } from '../../i18n'

export function SkillMatrix(props: { skills: Skill[] }) {
  const { t } = useI18n()

  return (
    <Panel
      title={t.competencyEngine.sections.skills}
      right={
        <span className="mcMono mcMuted">
          {props.skills.length} {t.competencyEngine.stats.skills.toLowerCase()}
        </span>
      }
    >
      {props.skills.length === 0 ? (
        <div className="mcProfilePanelBody">
          <div className="mcCompetencyEmpty">{t.competencyEngine.empty.skills}</div>
        </div>
      ) : (
        <table className="mcTable">
          <thead>
            <tr>
              <th>{t.competencyEngine.fields.skill}</th>
              <th>{t.competencyEngine.fields.category}</th>
              <th>{t.competencyEngine.fields.level}</th>
              <th>{t.competencyEngine.fields.verified}</th>
            </tr>
          </thead>
          <tbody>
            {props.skills.map((skill) => (
              <tr key={skill.id}>
                <td style={{ fontWeight: 600 }}>{skill.name}</td>
                <td className="mcMuted">{skill.category}</td>
                <td>
                  <div className="mcCompetencyLevelBar">
                    <span
                      className="mcCompetencyLevelFill"
                      style={{ width: `${(skill.level / 5) * 100}%` }}
                    />
                    <span className="mcCompetencyLevelText mcMono">{skill.level}/5</span>
                  </div>
                </td>
                <td className="mcMono">
                  {skill.verified ? t.employeeProfile.yes : t.employeeProfile.no}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
