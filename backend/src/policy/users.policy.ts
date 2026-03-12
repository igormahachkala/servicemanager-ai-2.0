import { UserRole } from '@prisma/client';

export class UsersPolicy {
  static listWhere(companyId: string) {
    return { companyId };
  }

  static byIdWhere(companyId: string, userId: string) {
    return {
      id: userId,
      companyId,
    };
  }

  static createData(
    companyId: string,
    data: { email: string; password: string; role: UserRole },
  ) {
    return {
      companyId,
      email: data.email,
      password: data.password,
      role: data.role,
      isActive: true,
    };
  }

  static updateData(data: {
    email?: string;
    password?: string;
    role?: UserRole;
    isActive?: boolean;
  }) {
    return {
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.password !== undefined ? { password: data.password } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    };
  }

  static selectPublicUser() {
    return {
      id: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    } as const;
  }
}
