import type { ApprovalRule } from '../../domain/approval/approvalRule'
import { APPROVAL_RULES } from '../../domain/approval/approvalRule'
import { useI18n } from '../../i18n'

function ruleClass(rule: string): string {
  if (rule === 'always_required' || rule === 'owner_only') return 'mcApprovalPolicyStrict'
  if (rule === 'auto_approve') return 'mcApprovalPolicyAuto'
  if (rule === 'disabled') return 'mcApprovalPolicyDisabled'
  return 'mcApprovalPolicyDefault'
}

export function ApprovalPolicyBadge({ rule }: { rule: string }) {
  const { t } = useI18n()
  const label =
    (APPROVAL_RULES as readonly string[]).includes(rule)
      ? t.approvalEngine.rules[rule as ApprovalRule]
      : rule

  return (
    <span className={`mcApprovalPolicyBadge ${ruleClass(rule)}`}>
      {label}
    </span>
  )
}
