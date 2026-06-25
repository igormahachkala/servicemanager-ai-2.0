import { Panel } from './ui'
import { optionLabel } from '../data/customEmployees'
import type { CustomEmployee } from '../data/customEmployees'
import { useI18n } from '../../i18n'

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) return <span className="mcMuted">{emptyLabel}</span>
  return (
    <div className="mcTagRow">
      {items.map((item) => (
        <span key={item} className="mcTag">
          {item}
        </span>
      ))}
    </div>
  )
}

export function EmployeeOverview({ employee }: { employee: CustomEmployee }) {
  const { t } = useI18n()

  return (
    <div className="mcProfileGrid">
      <Panel title={t.employeeProfile.sections.overview}>
        <div className="mcProfilePanelBody">
          <div className="mcProfileFieldGrid">
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.employeeBuilder.fields.description}</div>
              <div className="mcProfileFieldValue">
                {employee.description.trim() || t.employeeProfile.noDescription}
              </div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.employeeBuilder.fields.primaryModel}</div>
              <div className="mcProfileFieldValue mcMono">{employee.primaryModel}</div>
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.employeeBuilder.fields.fallbackModels}</div>
              <TagList items={employee.fallbackModels} emptyLabel={t.common.empty} />
            </div>
            <div className="mcProfileField">
              <div className="mcProfileFieldLabel">{t.employeeBuilder.sections.tools}</div>
              <TagList items={employee.tools} emptyLabel={t.common.empty} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={t.employeeBuilder.sections.restrictions}>
        <div className="mcProfilePanelBody">
          <TagList
            items={employee.restrictions.map((item) =>
              optionLabel(t.employeeBuilder.options.restrictions, item),
            )}
            emptyLabel={t.employeeProfile.noRestrictions}
          />
        </div>
      </Panel>

      <Panel title={t.employeeBuilder.fields.systemPrompt}>
        <div className="mcProfilePanelBody">
          <pre className="mcProfileCodeBlock">
            {employee.systemPrompt.trim() || t.employeeProfile.noSystemPrompt}
          </pre>
        </div>
      </Panel>

      <Panel title={t.employeeBuilder.fields.workflow}>
        <div className="mcProfilePanelBody">
          <div className="mcProfileFieldValue">
            {employee.workflow.trim() || t.employeeProfile.noWorkflow}
          </div>
        </div>
      </Panel>
    </div>
  )
}
