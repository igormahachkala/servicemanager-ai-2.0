import { Link } from 'react-router-dom'
import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { useI18n } from '../../i18n'
import { MobileEmployeePicker } from '../components/MobileEmployeePicker'
import { MobileSection } from '../components/MobileSection'
import { MobileTaskComposer } from '../components/MobileTaskComposer'
import { MobileTaskTemplateCard } from '../components/MobileTaskTemplateCard'
import { useMobileRunTask } from '../hooks/useMobileRunTask'
import { MOBILE_TASK_TEMPLATES } from '../runTask/mobileRunTaskConfig'

export function MobileRunTaskPage() {
  const { t } = useI18n()
  const copy = t.mobile.runTask
  const {
    form,
    employees,
    patchForm,
    selectEmployee,
    applyTemplate,
    submit,
    resetForm,
    startWorkday,
    validationError,
    createdItem,
    isMaxEmployee,
  } = useMobileRunTask()

  const employeeHref = `/mobile/employees/${encodeURIComponent(form.employeeId)}`

  if (createdItem) {
    return (
      <div className="acMobileRunTaskSuccess">
        <div className="acMobileRunTaskSuccessIcon" aria-hidden>
          <svg viewBox="0 0 48 48" className="acMobileEmptyStateSvg">
            <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
            <path
              d="M14 24l7 7 13-14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="acMobileRunTaskSuccessTitle">{copy.success.title}</h2>
        <p className="acMobileRunTaskSuccessDescription">{copy.success.description}</p>
        <p className="acMobileRunTaskSuccessTask">{createdItem.title}</p>

        <div className="acMobileRunTaskSuccessActions">
          <Link to={employeeHref} className="acMobilePrimaryBtn acMobileRunTaskSuccessBtn">
            {copy.success.openEmployee}
          </Link>
          <Link to={employeeHref} className="acMobileSecondaryBtn acMobileRunTaskSuccessBtn">
            {copy.success.openQueue}
          </Link>
          <button type="button" className="acMobileSecondaryBtn acMobileRunTaskSuccessBtn" onClick={resetForm}>
            {copy.success.addAnother}
          </button>
        </div>

        {isMaxEmployee ? (
          <div className="acMobileRunTaskMaxActions">
            <p className="acMobileRunTaskMaxActionsLabel">{copy.success.maxHint}</p>
            <div className="acMobileRunTaskMaxActionsGrid">
              <Link to={employeeHref} className="acMobileLinkBtn">
                {copy.success.openMax}
              </Link>
              <button type="button" className="acMobileLinkBtn" onClick={startWorkday}>
                {copy.success.startWorkday}
              </button>
              <Link to={employeeHref} className="acMobileLinkBtn">
                {copy.success.runNext}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="acMobileRunTask">
      <p className="acMobileRunTaskIntro">{copy.intro}</p>

      <MobileSection title={copy.sections.employee}>
        <MobileEmployeePicker
          employees={employees}
          selectedId={form.employeeId}
          onSelect={selectEmployee}
        />
      </MobileSection>

      <MobileSection title={copy.sections.templates} description={copy.templatesHint}>
        <div className="acMobileTaskTemplateGrid">
          {MOBILE_TASK_TEMPLATES.map((template) => (
            <MobileTaskTemplateCard
              key={template.id}
              template={template}
              selected={form.templateId === template.id}
              onSelect={applyTemplate}
            />
          ))}
        </div>
      </MobileSection>

      <MobileSection title={copy.sections.task}>
        <MobileTaskComposer
          form={form}
          validationError={validationError}
          onChange={patchForm}
          onSubmit={() => submit(copy.validation.emptyTaskText)}
        />
      </MobileSection>

      {form.employeeId !== MAX_WORKER_EMPLOYEE_ID ? null : (
        <p className="acMobileRunTaskNote">{copy.maxNote}</p>
      )}
    </div>
  )
}
