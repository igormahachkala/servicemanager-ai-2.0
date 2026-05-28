import { PrismaClient, UserRole, CompanyType, ServiceContractStatus, ServiceContractRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const QA_CLIENT_CO_ID = '10000000-0000-4000-8000-000000000001';
const QA_PROVIDER_CO_ID = '10000000-0000-4000-8000-000000000002';
const QA_SECONDARY_CO_ID = '10000000-0000-4000-8000-000000000003';
const QA_PASSWORD = 'StageQa123!';

async function main() {
  const hash = await bcrypt.hash(QA_PASSWORD, 10);

  const clientCo = await prisma.company.upsert({
    where: { id: QA_CLIENT_CO_ID },
    update: { name: 'QA Client Co', type: CompanyType.CLIENT },
    create: { id: QA_CLIENT_CO_ID, name: 'QA Client Co', type: CompanyType.CLIENT },
  });

  const providerCo = await prisma.company.upsert({
    where: { id: QA_PROVIDER_CO_ID },
    update: { name: 'QA Provider Co', type: CompanyType.PROVIDER },
    create: { id: QA_PROVIDER_CO_ID, name: 'QA Provider Co', type: CompanyType.PROVIDER },
  });

  const secondaryCo = await prisma.company.upsert({
    where: { id: QA_SECONDARY_CO_ID },
    update: { name: 'QA Secondary Provider Co', type: CompanyType.PROVIDER },
    create: { id: QA_SECONDARY_CO_ID, name: 'QA Secondary Provider Co', type: CompanyType.PROVIDER },
  });

  console.log(`[qa-seed] companies: ${clientCo.name}, ${providerCo.name}, ${secondaryCo.name}`);

  const users: Array<{ email: string; role: UserRole; companyId: string }> = [
    { email: 'client@test.local', role: UserRole.CLIENT, companyId: clientCo.id },
    { email: 'provider@test.local', role: UserRole.ADMIN, companyId: providerCo.id },
    { email: 'secondary.provider@test.local', role: UserRole.ADMIN, companyId: secondaryCo.id },
    { email: 'tech@test.local', role: UserRole.TECHNICIAN, companyId: providerCo.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { companyId: u.companyId, role: u.role, password: hash, isActive: true },
      create: { companyId: u.companyId, email: u.email, role: u.role, password: hash, isActive: true },
    });
    console.log(`[qa-seed] user ok: ${u.email} (${u.role})`);
  }

  await prisma.serviceContract.upsert({
    where: { clientCompanyId_providerCompanyId: { clientCompanyId: clientCo.id, providerCompanyId: providerCo.id } },
    update: { status: ServiceContractStatus.ACTIVE, role: ServiceContractRole.PRIMARY },
    create: {
      clientCompanyId: clientCo.id,
      providerCompanyId: providerCo.id,
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.PRIMARY,
    },
  });
  console.log('[qa-seed] PRIMARY contract: QA Provider -> QA Client');

  await prisma.serviceContract.upsert({
    where: { clientCompanyId_providerCompanyId: { clientCompanyId: clientCo.id, providerCompanyId: secondaryCo.id } },
    update: { status: ServiceContractStatus.ACTIVE, role: ServiceContractRole.SECONDARY },
    create: {
      clientCompanyId: clientCo.id,
      providerCompanyId: secondaryCo.id,
      status: ServiceContractStatus.ACTIVE,
      role: ServiceContractRole.SECONDARY,
    },
  });
  console.log('[qa-seed] SECONDARY contract: QA Secondary Provider -> QA Client');

  const userCheck = await prisma.user.findMany({
    where: { email: { in: users.map((u) => u.email) } },
    select: { email: true, role: true, isActive: true, companyId: true },
  });

  console.log('\n[qa-seed] Final verification:');
  for (const u of userCheck) {
    console.log(`  ${u.email} | role=${u.role} | isActive=${u.isActive} | companyId=${u.companyId}`);
  }
  console.log('\n[qa-seed] Done. All 4 QA users ready with password StageQa123!');
}

main()
  .catch((e) => {
    console.error('[qa-seed] FAILED', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
