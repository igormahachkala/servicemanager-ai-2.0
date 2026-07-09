import { MAX_WORKER_EMPLOYEE_ID } from '../../domain/maxWorkerLoop'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n'
import { useMobileRunNextSheet } from '../hooks/useMobileRunNextSheet'
import { useMobileRunTask } from '../hooks/useMobileRunTask'
import { MobileComplexTaskComposer } from '../components/MobileComplexTaskComposer'
import { MobileComplexTaskTemplateCard } from '../components/MobileComplexTaskTemplateCard'
import { MobileEmployeePicker } from '../components/MobileEmployeePicker'
import { MobileSection } from '../components/MobileSection'
import { MobileStandardTaskQuickStart } from '../components/MobileStandardTaskQuickStart'
import { MobileTaskComposer } from '../components/MobileTaskComposer'
import { MobileTaskModePicker } from '../components/MobileTaskModePicker'
import { MobileTaskTemplateCard } from '../components/MobileTaskTemplateCard'
import { MOBILE_STANDARD_TASK_TEMPLATE_ID, MOBILE_TASK_TEMPLATES } from '../runTask/mobileRunTaskConfig'

export function MobileRunTaskPage() {
  const { t } = useI18n()
  const copy = t.mobile.runTask
  const { openRunNextFlow } = useMobileRunNextSheet()
  const {
    taskMode,
    changeTaskMode,
    form,
    complexForm,
    employees,
    patchForm,
    patchComplexForm,
    selectEmployee,
    applyTemplate,
    applyComplexTemplate,
    submit,
    resetForm,
    validationError,
    submitError,
    createdItem,
    isMaxEmployee,
    isFormValid,
    maxEmployeeHref,
    complexTemplates,
  } = useMobileRunTask()

  if (createdItem) {
    const handleRunNow = () => {
      openRunNextFlow({ workItem: createdItem, goldenPath: true })
    }

    return (
      <div className="acMobilePage acMobileRunTaskSuccess">
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
          {isMaxEmployee ? (
            <>
              <button type="button" className="acMobilePrimaryBtn acMobileRunTaskSuccessBtn" onClick={handleRunNow}>
                {copy.success.runNow}
              </button>
              <Link to={maxEmployeeHref} className="acMobileSecondaryBtn acMobileRunTaskSuccessBtn">
                {copy.success.openMax}
              </Link>
            </>
          ) : (
            <Link to={maxEmployeeHref} className="acMobilePrimaryBtn acMobileRunTaskSuccessBtn">
              {copy.success.openEmployee}
            </Link>
          )}
          <button type="button" className="acMobileSecondaryBtn acMobileRunTaskSuccessBtn" onClick={resetForm}>
            {copy.success.addAnother}
          </button>
        </div>
      </div>
    )
  }

  const standardTemplateSelected = taskMode === 'quick' && form.templateId === MOBILE_STANDARD_TASK_TEMPLATE_ID
  const isComplexMode = taskMode === 'complex'

  const validationMessages = {
    emptyTaskText: copy.validation.emptyTaskText,
    emptyTitle: copy.validation.emptyTitle,
    emptyObjective: copy.validation.emptyObjective,
    emptyComplexTitle: copy.validation.emptyComplexTitle,
    persistFailed: copy.validation.persistFailed,
  }

  return (
    <div className="acMobilePage acMobileRunTask">
      <p className="acMobilePageIntro acMobileRunTaskIntro">{copy.intro}</p>

      <MobileSection title={copy.sections.mode}>
        <MobileTaskModePicker mode={taskMode} onChange={changeTaskMode} />
        <p className="acMobileTaskModeHint">
          {isComplexMode ? copy.modes.complexHint : copy.modes.quickHint}
        </p>
      </MobileSection>

      {!standardTemplateSelected && !isComplexMode ? (
        <MobileStandardTaskQuickStart className="acMobileRunTaskStandardBanner" />
      ) : null}

      <MobileSection title={copy.sections.employee}>
        <MobileEmployeePicker
          employees={employees}
          selectedId={form.employeeId}
          onSelect={selectEmployee}
        />
      </MobileSection>

      <MobileSection
        title={isComplexMode ? copy.sections.complexTemplates : copy.sections.templates}
        description={copy.templatesHint}
      >
        <div className="acMobileTaskTemplateGrid" data-mobile-guide="task-templates">
          {isComplexMode
            ? complexTemplates.map((template) => (
                <MobileComplexTaskTemplateCard
                  key={template.id}
                  template={template}
                  selected={complexForm.templateId === template.id}
                  onSelect={applyComplexTemplate}
                />
              ))
            : MOBILE_TASK_TEMPLATES.map((template) => (
                <MobileTaskTemplateCard
                  key={template.id}
                  template={template}
                  selected={form.templateId === template.id}
                  onSelect={applyTemplate}
                />
              ))}
        </div>
      </MobileSection>

      <div data-mobile-guide="task-composer">
        <MobileSection title={isComplexMode ? copy.sections.complexTask : copy.sections.task}>
          {isComplexMode ? (
            <MobileComplexTaskComposer
              form={complexForm}
              validationError={validationError}
              submitError={submitError}
              isValid={isFormValid}
              onChange={patchComplexForm}
              onSubmit={() => submit(validationMessages)}
            />
          ) : (
            <MobileTaskComposer
              form={form}
              validationError={validationError}
              submitError={submitError}
              isValid={isFormValid}
              onChange={patchForm}
              onSubmit={() => submit(validationMessages)}
            />
          )}
        </MobileSection>
      </div>

      {form.employeeId !== MAX_WORKER_EMPLOYEE_ID ? null : (
        <p className="acMobileRunTaskNote">{copy.maxNote}</p>
      )}
    </div>
  )
}
