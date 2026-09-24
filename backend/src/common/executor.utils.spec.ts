import { UserRole } from '@prisma/client';
import { EXECUTOR_CAPABLE_ROLES, isExecutorCapableRole, isExecutorEligible } from './executor.utils';

describe('executor.utils', () => {
  describe('EXECUTOR_CAPABLE_ROLES', () => {
    it('includes TECHNICIAN, MASTER, DISPATCHER, ADMIN', () => {
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.TECHNICIAN)).toBe(true);
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.MASTER)).toBe(true);
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.DISPATCHER)).toBe(true);
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.ADMIN)).toBe(true);
    });

    it('does not include CLIENT, NETWORK_DIRECTOR, PLATFORM_ADMIN', () => {
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.CLIENT)).toBe(false);
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.NETWORK_DIRECTOR)).toBe(false);
      expect(EXECUTOR_CAPABLE_ROLES.has(UserRole.PLATFORM_ADMIN)).toBe(false);
    });
  });

  describe('isExecutorCapableRole', () => {
    it('returns true for executor-capable roles', () => {
      expect(isExecutorCapableRole(UserRole.TECHNICIAN)).toBe(true);
      expect(isExecutorCapableRole(UserRole.ADMIN)).toBe(true);
      expect(isExecutorCapableRole(UserRole.MASTER)).toBe(true);
      expect(isExecutorCapableRole(UserRole.DISPATCHER)).toBe(true);
    });

    it('returns false for non-executor roles', () => {
      expect(isExecutorCapableRole(UserRole.CLIENT)).toBe(false);
      expect(isExecutorCapableRole(UserRole.NETWORK_DIRECTOR)).toBe(false);
      expect(isExecutorCapableRole(UserRole.PLATFORM_ADMIN)).toBe(false);
    });
  });

  describe('isExecutorEligible', () => {
    it('TECHNICIAN with isExecutor=true is eligible', () => {
      expect(isExecutorEligible({ role: UserRole.TECHNICIAN, isExecutor: true })).toBe(true);
    });

    it('TECHNICIAN with isExecutor=false is NOT eligible', () => {
      expect(isExecutorEligible({ role: UserRole.TECHNICIAN, isExecutor: false })).toBe(false);
    });

    it('ADMIN with isExecutor=true is eligible', () => {
      expect(isExecutorEligible({ role: UserRole.ADMIN, isExecutor: true })).toBe(true);
    });

    it('ADMIN with isExecutor=false is NOT eligible', () => {
      expect(isExecutorEligible({ role: UserRole.ADMIN, isExecutor: false })).toBe(false);
    });

    it('MASTER with isExecutor=true is eligible', () => {
      expect(isExecutorEligible({ role: UserRole.MASTER, isExecutor: true })).toBe(true);
    });

    it('DISPATCHER with isExecutor=true is eligible', () => {
      expect(isExecutorEligible({ role: UserRole.DISPATCHER, isExecutor: true })).toBe(true);
    });

    it('CLIENT with isExecutor=true is still NOT eligible (role gate)', () => {
      expect(isExecutorEligible({ role: UserRole.CLIENT, isExecutor: true })).toBe(false);
    });

    it('NETWORK_DIRECTOR with isExecutor=true is still NOT eligible', () => {
      expect(isExecutorEligible({ role: UserRole.NETWORK_DIRECTOR, isExecutor: true })).toBe(false);
    });

    it('PLATFORM_ADMIN with isExecutor=true is still NOT eligible', () => {
      expect(isExecutorEligible({ role: UserRole.PLATFORM_ADMIN, isExecutor: true })).toBe(false);
    });
  });
});
