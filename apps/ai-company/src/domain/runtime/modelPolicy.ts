export type ModelPolicy = {
  localFirst: boolean
  cloudAllowed: boolean
  sensitiveDataAllowed: boolean
  maxCostPerRun: number
  requireApprovalForCloud: boolean
  requireApprovalForExternalTools: boolean
  fallbackOnFailure: boolean
}

export type PrivacyPolicy = {
  localFirst: boolean
  cloudAllowed: boolean
  sensitiveDataAllowed: boolean
  requireApprovalForCloud: boolean
}

export type CostPolicy = {
  maxCostPerRun: number
  maxTokensPerRun: number
}

export const DEFAULT_MODEL_POLICY: ModelPolicy = {
  localFirst: true,
  cloudAllowed: true,
  sensitiveDataAllowed: false,
  maxCostPerRun: 0.5,
  requireApprovalForCloud: false,
  requireApprovalForExternalTools: true,
  fallbackOnFailure: true,
}

export const DEFAULT_PRIVACY_POLICY: PrivacyPolicy = {
  localFirst: true,
  cloudAllowed: true,
  sensitiveDataAllowed: false,
  requireApprovalForCloud: false,
}

export const DEFAULT_COST_POLICY: CostPolicy = {
  maxCostPerRun: 0.5,
  maxTokensPerRun: 8192,
}

export function modelPolicyFromProfile(
  privacyPolicy: PrivacyPolicy,
  costPolicy: CostPolicy,
): ModelPolicy {
  return {
    localFirst: privacyPolicy.localFirst,
    cloudAllowed: privacyPolicy.cloudAllowed,
    sensitiveDataAllowed: privacyPolicy.sensitiveDataAllowed,
    maxCostPerRun: costPolicy.maxCostPerRun,
    requireApprovalForCloud: privacyPolicy.requireApprovalForCloud,
    requireApprovalForExternalTools: true,
    fallbackOnFailure: true,
  }
}
