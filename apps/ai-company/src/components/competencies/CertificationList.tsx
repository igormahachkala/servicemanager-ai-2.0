import { Panel } from '../../mission-control/components/ui'
import type { Certification } from '../../domain/competencies/certification'
import { useI18n } from '../../i18n'

export function CertificationList(props: { certifications: Certification[] }) {
  const { t } = useI18n()

  return (
    <Panel title={t.competencyEngine.sections.certificates}>
      {props.certifications.length === 0 ? (
        <div className="mcProfilePanelBody">
          <div className="mcCompetencyEmpty">{t.competencyEngine.empty.certificates}</div>
        </div>
      ) : (
        <table className="mcTable">
          <thead>
            <tr>
              <th>{t.labels.title}</th>
              <th>{t.competencyEngine.fields.issuer}</th>
              <th>{t.labels.status}</th>
              <th>{t.competencyEngine.fields.completedAt}</th>
            </tr>
          </thead>
          <tbody>
            {props.certifications.map((cert) => (
              <tr key={cert.id}>
                <td style={{ fontWeight: 600 }}>{cert.title}</td>
                <td>{cert.issuer}</td>
                <td className="mcMono">{t.competencyEngine.certificationStatus[cert.status]}</td>
                <td className="mcMono mcMuted">
                  {cert.completedAt ? new Date(cert.completedAt).toLocaleDateString() : t.common.empty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
