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

    expect(rows).toHaveLength(81);
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
    // CLIENT_ADMIN — строго read-only: только TICKETS_VIEW + WORKFORCE_VIEW.
    expect(codesFor(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).toEqual([
      PERMISSIONS.TICKETS_VIEW,
      PERMISSIONS.WORKFORCE_VIEW,
    ]);
    // Negative control: любая write/management-capability у CLIENT_ADMIN = провал.
    expect(codesFor(UserRole.CLIENT_ADMIN, CompanyType.CLIENT)).not.toEqual(
      expect.arrayContaining([
        PERMISSIONS.WORKFORCE_SHIFT_USE,
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.COMPANY_SETTINGS_EDIT,
        PERMISSIONS.LOCATIONS_MANAGE,
        PERMISSIONS.TICKETS_CREATE,
        PERMISSIONS.TICKETS_EDIT,
      ]),
    );

    // Role regression: Workforce management view остаётся закрытым для
    // не-управленческих ролей; управленческие роли сохраняют доступ.
    for (const [role, ct] of [
      [UserRole.CLIENT, CompanyType.CLIENT],
      [UserRole.TECHNICIAN, CompanyType.PROVIDER],
      [UserRole.STAFF, null],
    ] as const) {
      expect(codesFor(role, ct)).not.toContain(PERMISSIONS.WORKFORCE_VIEW);
    }
    for (const [role, ct] of [
      [UserRole.ADMIN, CompanyType.CLIENT],
      [UserRole.ADMIN, CompanyType.PROVIDER],
      [UserRole.MASTER, CompanyType.PROVIDER],
      [UserRole.DISPATCHER, CompanyType.PROVIDER],
      [UserRole.PLATFORM_ADMIN, null],
    ] as const) {
      expect(codesFor(role, ct)).toContain(PERMISSIONS.WORKFORCE_VIEW);
    }

    const wildcardRoles = ROLE_GRANTS.filter(
      (grant) => grant.companyType === null,
    ).map((grant) => grant.role);
    expect(new Set(wildcardRoles)).toEqual(
      new Set([UserRole.PLATFORM_ADMIN, UserRole.STAFF]),
    );
  });
});
