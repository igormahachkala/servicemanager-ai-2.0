export type PolicyDecision<TWhere = any> = {
  allow: boolean;
  reason?: string;
  where?: TWhere;
};

export const allow = <TWhere = any>(where?: TWhere): PolicyDecision<TWhere> => ({ allow: true, where });
export const deny = (reason: string): PolicyDecision => ({ allow: false, reason });
