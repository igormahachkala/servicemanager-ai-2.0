import { TOOL_POLICIES, POLICY_SEVERITY } from '../../data/toolPolicies'
import type { ToolAccessPolicy } from '../../data/toolPolicies'
import { useI18n } from '../../../i18n'

export function PolicyMatrix(props: { active: ToolAccessPolicy[] }) {
  const { t } = useI18n()
  const activeSet = new Set(props.active)

  return (
    <div className="mcToolPolicyMatrix">
      {TOOL_POLICIES.map((policy) => {
        const isActive = activeSet.has(policy)
        const severity = POLICY_SEVERITY[policy]
        return (
          <div
            key={policy}
            className={
              isActive
                ? `mcToolPolicyRow mcToolPolicyRowActive mcToolPolicyRow${capitalize(severity)}`
                : 'mcToolPolicyRow'
            }
          >
            <span className="mcToolPolicyLabel">{t.toolRegistry.policies[policy]}</span>
            <span className="mcToolPolicyState">
              {isActive ? t.toolRegistry.matrix.active : t.toolRegistry.matrix.inactive}
            </span>
            <span className="mcToolPolicyHint">{t.toolRegistry.policyHints[policy]}</span>
          </div>
        )
      })}
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
