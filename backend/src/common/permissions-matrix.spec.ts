import { CompanyType, UserRole } from '@prisma/client';

import { PERMISSIONS } from './permissions.constants';
import { ROLE_GRANTS } from './permissions-matrix';

function codesFor(role: UserRole, companyType: CompanyType | null) {
  return ROLE_GRANTS.find(
    (grant) => grant.role === role && grant.companyType === companyType,
  )?.codes ?? [];
}

describe('ROLE_GRANTS', () => {
  it('matches the canonical company-type-aware PBAC matrix', () => {
    const rows = ROLE_GRANTS.flatMap((grant) =>
      grant.codes.map(
        (code) => `${grant.role}|${grant.companyType ?? '*'}|${code}`,
      ),
    );

    expect(rows).toHaveLength(79);
    expect(new Set(rows).size).toBe(rows.length);

    expect(codesFor(UserRole.ADMIN, CompanyType.CLIENT)).not.toEqual(
      expect.arrayContaining([
        PERMISSIONS.TICKETS_ASSIGN,
        PERMISSIONS.TICKETS_CLAIM,
        PERMISSIONS.TICKETS_STATUS_CHANGE,
        PERMISSIONS.TICKETS_VIEW_AVAILABLE,
      ]),
    );
    expect(
      codesFor(UserRole.NETWORK_DIRECTOR, CompanyType.CLIENT),
    ).not.toContain(PERMISSIONS.TICKETS_STATUS_CHANGE);

    const wildcardRoles = ROLE_GRANTS.filter(
      (grant) => grant.companyType === null,
    ).map((grant) => grant.role);
    expect(new Set(wildcardRoles)).toEqual(
      new Set([UserRole.PLATFORM_ADMIN, UserRole.STAFF]),
    );
  });
});
