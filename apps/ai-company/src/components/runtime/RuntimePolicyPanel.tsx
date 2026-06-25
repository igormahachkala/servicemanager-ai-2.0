import type { CostPolicy, PrivacyPolicy } from '../../domain/runtime/runtimeStorage'
import { useI18n } from '../../i18n'

type RuntimePolicyPanelProps = {
  privacyPolicy: PrivacyPolicy
  costPolicy: CostPolicy
}

export function RuntimePolicyPanel({ privacyPolicy, costPolicy }: RuntimePolicyPanelProps) {
  const { t } = useI18n()

  return (
    <div className="mcRuntimePolicyGrid">
      <section className="mcRuntimePolicyCard">
        <h3 className="mcRuntimePolicyTitle">{t.runtimeEngine.privacyPolicy}</h3>
        <ul className="mcRuntimePolicyList">
          <li>
            <span>{t.runtimeEngine.policy.localFirst}</span>
            <span>{privacyPolicy.localFirst ? t.employeeProfile.yes : t.employeeProfile.no}</span>
          </li>
          <li>
            <span>{t.runtimeEngine.policy.cloudAllowed}</span>
            <span>{privacyPolicy.cloudAllowed ? t.employeeProfile.yes : t.employeeProfile.no}</span>
          </li>
          <li>
            <span>{t.runtimeEngine.policy.sensitiveDataAllowed}</span>
            <span>
              {privacyPolicy.sensitiveDataAllowed ? t.employeeProfile.yes : t.employeeProfile.no}
            </span>
          </li>
          <li>
            <span>{t.runtimeEngine.policy.requireApprovalForCloud}</span>
            <span>
              {privacyPolicy.requireApprovalForCloud
                ? t.employeeProfile.yes
                : t.employeeProfile.no}
            </span>
          </li>
        </ul>
      </section>

      <section className="mcRuntimePolicyCard">
        <h3 className="mcRuntimePolicyTitle">{t.runtimeEngine.costPolicy}</h3>
        <ul className="mcRuntimePolicyList">
          <li>
            <span>{t.runtimeEngine.policy.maxCostPerRun}</span>
            <span className="mcMono">${costPolicy.maxCostPerRun.toFixed(2)}</span>
          </li>
          <li>
            <span>{t.runtimeEngine.policy.maxTokensPerRun}</span>
            <span className="mcMono">{costPolicy.maxTokensPerRun}</span>
          </li>
        </ul>
      </section>
    </div>
  )
}
