import { PrismaClient, TicketStatus, TicketUrgency, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const prisma = new PrismaClient();

export async function resetDb() {
  // порядок важен из-за FK
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.ticket.deleteMany();

  await prisma.technicianSpecialization.deleteMany();
  await prisma.problemCategorySpecialization.deleteMany();
  await prisma.problemCategory.deleteMany();
  await prisma.specialization.deleteMany();

  await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permissionBlock.deleteMany();

  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

export async function ensurePermissionBlocks(codes: string[]) {
  for (const code of codes) {
    await prisma.permissionBlock.upsert({
      where: { code },
      update: {},
      create: {
        code,
        name: code,
        description: `e2e seed: ${code}`,
      },
    });
  }
}

export async function grantRolePermissions(role: UserRole, codes: string[]) {
  const blocks = await prisma.permissionBlock.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });

  if (blocks.length !== codes.length) {
    const found = new Set(blocks.map((b) => b.code));
    const missing = codes.filter((c) => !found.has(c));
    throw new Error(`Missing PermissionBlocks: ${missing.join(', ')}`);
  }

  await prisma.rolePermission.createMany({
    data: blocks.map((b) => ({ role, permissionBlockId: b.id })),
    skipDuplicates: true,
  });
}

export async function grantUserPermissions(userId: string, codes: string[]) {
  const blocks = await prisma.permissionBlock.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });

  if (blocks.length !== codes.length) {
    const found = new Set(blocks.map((b) => b.code));
    const missing = codes.filter((c) => !found.has(c));
    throw new Error(`Missing PermissionBlocks: ${missing.join(', ')}`);
  }

  await prisma.userPermission.createMany({
    data: blocks.map((b) => ({ userId, permissionBlockId: b.id })),
    skipDuplicates: true,
  });
}

export async function createCompanyWithUsers(params?: {
  companyName?: string;
  adminEmail?: string;
  adminPassword?: string;
  techEmail?: string;
  techPassword?: string;
  otherTechEmail?: string;
  otherTechPassword?: string;
}) {
  const companyName = params?.companyName ?? 'E2E Company';
  const adminEmail = (params?.adminEmail ?? 'admin@example.com').toLowerCase();
  const adminPassword = params?.adminPassword ?? 'Passw0rd!';
  const techEmail = (params?.techEmail ?? 'tech@example.com').toLowerCase();
  const techPassword = params?.techPassword ?? 'Passw0rd!';
  const otherTechEmail = (params?.otherTechEmail ?? 'tech2@example.com').toLowerCase();
  const otherTechPassword = params?.otherTechPassword ?? 'Passw0rd!';

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const techHash = await bcrypt.hash(techPassword, 10);
  const otherTechHash = await bcrypt.hash(otherTechPassword, 10);

  const company = await prisma.company.create({
    data: {
      name: companyName,
      autoAssignEnabled: false, // в e2e выключаем автоназначение, чтобы тесты были детерминированные
      users: {
        create: [
          { email: adminEmail, password: adminHash, role: UserRole.ADMIN },
          { email: techEmail, password: techHash, role: UserRole.TECHNICIAN },
          { email: otherTechEmail, password: otherTechHash, role: UserRole.TECHNICIAN },
        ],
      },
    },
    include: { users: true },
  });

  const admin = company.users.find((u) => u.email === adminEmail)!;
  const tech = company.users.find((u) => u.email === techEmail)!;
  const otherTech = company.users.find((u) => u.email === otherTechEmail)!;

  return {
    company,
    admin: { ...admin, passwordPlain: adminPassword },
    tech: { ...tech, passwordPlain: techPassword },
    otherTech: { ...otherTech, passwordPlain: otherTechPassword },
  };
}

export async function createSpecAndCategory(companyId: string) {
  const spec = await prisma.specialization.create({
    data: { companyId, name: 'E2E Spec', isActive: true },
  });

  const categoryOk = await prisma.problemCategory.create({
    data: { companyId, name: 'E2E Category OK', isActive: true, instructions: 'ok' },
  });

  await prisma.problemCategorySpecialization.create({
    data: { problemCategoryId: categoryOk.id, specializationId: spec.id },
  });

  const categoryNoMatch = await prisma.problemCategory.create({
    data: { companyId, name: 'E2E Category NO_MATCH', isActive: true },
  });

  return { spec, categoryOk, categoryNoMatch };
}

export async function linkTechToSpec(techUserId: string, specId: string) {
  await prisma.technicianSpecialization.create({
    data: { userId: techUserId, specializationId: specId },
  });
}

export async function createTicket(params: {
  companyId: string;
  problemCategoryId: string;
  problemText?: string;
  status?: TicketStatus;
  assignedTechnicianId?: string | null;
}) {
  const t = await prisma.ticket.create({
    data: {
      companyId: params.companyId,
      problemCategoryId: params.problemCategoryId,
      problemText: params.problemText ?? 'E2E problem',
      urgency: TicketUrgency.NOT_URGENT,
      status: params.status ?? TicketStatus.NEW,
      assignedTechnicianId: params.assignedTechnicianId ?? null,
    },
  });

  // у вас логика обычно пишет history при создании через сервис,
  // но тут нам важны только проверки доступов/claim/status_change.
  return t;
}
