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
    data: {
      email: string;
      password: string;
      role: UserRole;
      firstName?: string | null;
      lastName?: string | null;
      profilePhotoUrl?: string | null;
    },
  ) {
    return {
      companyId,
      email: data.email,
      password: data.password,
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.profilePhotoUrl !== undefined ? { profilePhotoUrl: data.profilePhotoUrl } : {}),
      role: data.role,
      isActive: true,
    };
  }

  static updateData(data: {
    email?: string;
    password?: string;
    role?: UserRole;
    isActive?: boolean;
    firstName?: string | null;
    lastName?: string | null;
    profilePhotoUrl?: string | null;
  }) {
    return {
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.password !== undefined ? { password: data.password } : {}),
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
      ...(data.profilePhotoUrl !== undefined ? { profilePhotoUrl: data.profilePhotoUrl } : {}),
    };
  }

  static selectPublicUser() {
    return {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profilePhotoUrl: true,
      role: true,
      isActive: true,
      createdAt: true,
      technicianSpecializations: {
        select: {
          specialization: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
        orderBy: {
          specialization: {
            name: 'asc',
          },
        },
      },
    } as const;
  }
}
