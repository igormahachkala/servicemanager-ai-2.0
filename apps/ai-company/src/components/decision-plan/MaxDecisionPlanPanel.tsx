import type { ReactNode } from 'react'
import { useI18n } from '../../i18n'
import type { MaxDecisionPlanView } from '../../domain/decisionPlan/decisionPlanViewModel'

type Props = {
  view: MaxDecisionPlanView | null
  compact?: boolean
}

function BoolBadge({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return (
    <span className={`acDecisionPlanBool acDecisionPlanBool--${value ? 'yes' : 'no'}`}>
      {value ? yes : no}
    </span>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="acDecisionPlanField">
      <dt className="acDecisionPlanFieldLabel">{label}</dt>
      <dd className="acDecisionPlanFieldValue">{children}</dd>
    </div>
  )
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="mcMuted">—</span>
  return (
    <ul className="acDecisionPlanTags">
      {items.map((item) => (
        <li key={item} className="acDecisionPlanTag">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function MaxDecisionPlanPanel({ view, compact = false }: Props) {
  const { t } = useI18n()
  const dp = t.decisionPlan

  if (!view) {
    return (
      <div className={`acDecisionPlan acDecisionPlanEmpty${compact ? ' acDecisionPlanCompact' : ''}`}>
        <h3 className="acDecisionPlanTitle">{dp.title}</h3>
        <p className="acDecisionPlanEmptyText">{dp.empty.message}</p>
        <p className="acDecisionPlanEmptyHint mcMuted">{dp.empty.hint}</p>
      </div>
    )
  }

  return (
    <div className={`acDecisionPlan${compact ? ' acDecisionPlanCompact' : ''}`}>
      <header className="acDecisionPlanHead">
        <div>
          <h3 className="acDecisionPlanTitle">{dp.title}</h3>
          <p className="acDecisionPlanSubtitle">{dp.subtitle}</p>
        </div>
        <div className="acDecisionPlanHeadMeta">
          {view.isPreview ? (
            <span className="acDecisionPlanBadge acDecisionPlanBadgePreview">{dp.previewBadge}</span>
          ) : (
            <span className="acDecisionPlanBadge acDecisionPlanBadgeStored">{view.sourceLabel}</span>
          )}
        </div>
      </header>

      <dl className="acDecisionPlanGrid">
        <FieldBlock label={dp.fields.taskUnderstood}>
          <div>
            {view.taskTitle ? <strong>{view.taskTitle}</strong> : null}
            <p className="mcMuted">{view.taskDigest}</p>
            <span className="acDecisionPlanIntent">{view.classifiedIntentLabel}</span>
          </div>
        </FieldBlock>

        <FieldBlock label={dp.fields.brainProfile}>
          <div>
            <p>{view.brainSpecialization}</p>
            <p className="mcMuted">
              {dp.fields.decisionStyle}: {view.brainDecisionStyle}
            </p>
            <p className="acMono acDecisionPlanMeta">{view.brainProfileId}</p>
          </div>
        </FieldBlock>

        <FieldBlock label={dp.fields.primaryModel}>
          <div>
            <strong>{view.primaryModelLabel}</strong>
            <p className="mcMuted">{view.primaryModelReason}</p>
          </div>
        </FieldBlock>

        <FieldBlock label={dp.fields.multiModel}>
          <BoolBadge value={view.useMultipleModels} yes={dp.values.yes} no={dp.values.no} />
          {view.multiModelNote ? <p className="mcMuted">{view.multiModelNote}</p> : null}
          {view.modelPipeline.length > 1 ? (
            <ul className="acDecisionPlanPipeline">
              {view.modelPipeline.map((item) => (
                <li key={`${item.label}-${item.role}`}>
                  <strong>{item.label}</strong>
                  <span className="acDecisionPlanTag">{item.role}</span>
                  <p className="mcMuted">{item.reason}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </FieldBlock>

        <FieldBlock label={dp.fields.tools}>
          <BoolBadge
            value={view.toolRegistryRequired}
            yes={dp.values.required}
            no={dp.values.notRequired}
          />
          {view.suggestedTools.length > 0 ? (
            <ul className="acDecisionPlanTags">
              {view.suggestedTools.map((tool) => (
                <li key={tool.id} className="acDecisionPlanTag">
                  {tool.name}
                </li>
              ))}
            </ul>
          ) : null}
          {view.toolRegistryReason ? <p className="mcMuted">{view.toolRegistryReason}</p> : null}
        </FieldBlock>

        <FieldBlock label={dp.fields.cursorAutomation}>
          <BoolBadge
            value={view.cursorAutomationRequired}
            yes={dp.values.required}
            no={dp.values.notRequired}
          />
          {view.cursorAutomationReason ? (
            <p className="mcMuted">{view.cursorAutomationReason}</p>
          ) : null}
        </FieldBlock>

        <FieldBlock label={dp.fields.ownerApproval}>
          <BoolBadge
            value={view.ownerApprovalRequired}
            yes={dp.values.required}
            no={dp.values.notRequired}
          />
          {view.ownerApprovalReasons.length > 0 ? (
            <ul className="acDecisionPlanReasons">
              {view.ownerApprovalReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </FieldBlock>

        <FieldBlock label={dp.fields.expectedResult}>
          <p>{view.expectedSummary}</p>
          {view.deliverables.length > 0 ? (
            <>
              <p className="acDecisionPlanSubhead">{dp.fields.deliverables}</p>
              <TagList items={view.deliverables} />
            </>
          ) : null}
          {view.acceptanceCriteria.length > 0 ? (
            <>
              <p className="acDecisionPlanSubhead">{dp.fields.acceptanceCriteria}</p>
              <TagList items={view.acceptanceCriteria} />
            </>
          ) : null}
        </FieldBlock>

        <FieldBlock label={dp.fields.matchedSignals}>
          <TagList items={view.matchedSignals} />
        </FieldBlock>

        <FieldBlock label={dp.fields.rationale}>
          {view.rationale.length > 0 ? (
            <ul className="acDecisionPlanReasons">
              {view.rationale.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <span className="mcMuted">—</span>
          )}
        </FieldBlock>
      </dl>
    </div>
  )
}
