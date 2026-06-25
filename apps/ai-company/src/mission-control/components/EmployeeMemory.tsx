import { Link } from 'react-router-dom'
import { Panel } from './ui'
import { ProfileEmptyBlock } from './ProfileEmptyBlock'
import { optionLabel } from '../data/customEmployees'
import type { CustomEmployee } from '../data/customEmployees'
import { useMemory } from '../../hooks/useMemory'
import { useI18n } from '../../i18n'

export function EmployeeMemory({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()
  const { stats, entries } = useMemory(employee.id)

  return (
    <div className="mcStack">
      <Panel title={t.employeeProfile.sections.memory}>
        <div className="mcProfilePanelBody">
          <p className="mcMemoryInlineNote">{t.memoryEngine.summary.modelIndependent}</p>

          {employee.memoryScope.length === 0 ? (
            <div className="mcProfileEmpty mcProfileEmptyInline" style={{ marginTop: 12 }}>
              <div className="mcProfileEmptyTitle">{t.employeeProfile.noMemoryScope}</div>
              <p className="mcProfileEmptyDesc">{t.employeeProfile.noMemoryScopeHint}</p>
            </div>
          ) : (
            <div className="mcTagRow" style={{ marginTop: 12 }}>
              {employee.memoryScope.map((scope) => (
                <span key={scope} className="mcTag">
                  {optionLabel(t.employeeBuilder.options.memoryScope, scope)}
                </span>
              ))}
            </div>
          )}

          <div className="mcMemoryInlineStats mcMono mcMuted">
            {stats.total} {t.memoryEngine.stats.total.toLowerCase()} · {stats.recentWeek}{' '}
            {t.memoryEngine.stats.recentWeek.toLowerCase()}
          </div>

          <div className="mcFormActions" style={{ marginTop: 12 }}>
            <Link
              to={`/ops/employees/${employee.id}/memory`}
              className="mcBtn mcBtnPrimary mcBtnSmall"
            >
              {t.memoryEngine.openMemory}
            </Link>
          </div>
        </div>
      </Panel>

      <Panel title={t.employeeProfile.future.memoryTimeline}>
        <div className="mcProfilePanelBody">
          {entries.length === 0 ? (
            <ProfileEmptyBlock
              badge={t.employeeProfile.futureBadge}
              title={t.employeeProfile.future.memoryTimeline}
              description={t.employeeProfile.future.memoryTimelineDesc}
            />
          ) : (
            <>
              <p className="mcMuted" style={{ fontSize: 13, margin: '0 0 12px' }}>
                {entries.slice(0, 2).map((entry) => entry.title).join(' · ')}
              </p>
              <Link
                to={`/ops/employees/${employee.id}/memory`}
                className="mcBtn mcBtnSecondary mcBtnSmall"
              >
                {t.memoryEngine.viewTimeline}
              </Link>
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
