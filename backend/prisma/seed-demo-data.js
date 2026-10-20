const { PrismaClient, UserRole, TicketStatus, TicketUrgency } = require('@prisma/client');

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function getUserByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, companyId: true },
  });
}

async function ensureSpecializations(companyId) {
  const names = [
    'Электрика',
    'Сантехника',
    'Холодильное оборудование',
    'Кассовое оборудование',
    'Кондиционирование',
    'Сеть и интернет',
    'Общестроительные работы',
  ];

  const result = [];

  for (const name of names) {
    const existing = await prisma.specialization.findFirst({
      where: {
        companyId,
        name,
      },
    });

    let item;

    if (existing) {
      item = await prisma.specialization.update({
        where: { id: existing.id },
        data: {
          isActive: true,
        },
      });
    } else {
      item = await prisma.specialization.create({
        data: {
          companyId,
          name,
          isActive: true,
        },
      });
    }

    result.push(item);
  }

  return result;
}

async function ensureProblemCategories(companyId) {
  const items = [
    {
      name: 'Проблема с электрикой',
      instructions: 'Проверить питание, автоматы, кабельные соединения, нагрузку.',
    },
    {
      name: 'Проблема с сантехникой',
      instructions: 'Проверить протечки, давление, запорную арматуру, соединения.',
    },
    {
      name: 'Проблема с холодильником',
      instructions: 'Проверить температуру, питание, компрессор, утечку холода.',
    },
    {
      name: 'Проблема с кассой',
      instructions: 'Проверить питание, сеть, фискальный режим, подключение периферии.',
    },
    {
      name: 'Проблема с интернетом',
      instructions: 'Проверить роутер, кабель, питание, доступность канала.',
    },
    {
      name: 'Проблема с кондиционером',
      instructions: 'Проверить питание, фильтры, наружный блок, режим работы.',
    },
  ];

  const result = [];

  for (const item of items) {
    const category = await prisma.problemCategory.upsert({
      where: {
        companyId_name: {
          companyId,
          name: item.name,
        },
      },
      update: {
        instructions: item.instructions,
        isActive: true,
      },
      create: {
        companyId,
        name: item.name,
        instructions: item.instructions,
        isActive: true,
      },
    });

    result.push(category);
  }

  return result;
}

async function bindCategorySpecializations(categories, specs) {
  const specByName = new Map(specs.map((s) => [s.name, s]));
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const links = [
    ['Проблема с электрикой', ['Электрика']],
    ['Проблема с сантехникой', ['Сантехника']],
    ['Проблема с холодильником', ['Холодильное оборудование', 'Электрика']],
    ['Проблема с кассой', ['Кассовое оборудование', 'Сеть и интернет']],
    ['Проблема с интернетом', ['Сеть и интернет']],
    ['Проблема с кондиционером', ['Кондиционирование', 'Электрика']],
  ];

  for (const [categoryName, specNames] of links) {
    const category = categoryByName.get(categoryName);
    if (!category) continue;

    await prisma.problemCategorySpecialization.deleteMany({
      where: { problemCategoryId: category.id },
    });

    for (const specName of specNames) {
      const spec = specByName.get(specName);
      if (!spec) continue;

      await prisma.problemCategorySpecialization.upsert({
        where: {
          problemCategoryId_specializationId: {
            problemCategoryId: category.id,
            specializationId: spec.id,
          },
        },
        update: {},
        create: {
          problemCategoryId: category.id,
          specializationId: spec.id,
        },
      });
    }
  }
}

async function bindTechnicianSpecializations(specs) {
  const specByName = new Map(specs.map((s) => [s.name, s]));

  const techMap = [
    ['tech1@test.com', ['Электрика', 'Сеть и интернет']],
    ['tech2@test.com', ['Сантехника']],
    ['tech3@test.com', ['Холодильное оборудование', 'Кондиционирование']],
    ['tech4@test.com', ['Кассовое оборудование', 'Сеть и интернет']],
  ];

  for (const [email, specNames] of techMap) {
    const user = await getUserByEmail(email);
    if (!user) continue;

    await prisma.technicianSpecialization.deleteMany({
      where: { userId: user.id },
    });

    for (const specName of specNames) {
      const spec = specByName.get(specName);
      if (!spec) continue;

      await prisma.technicianSpecialization.upsert({
        where: {
          userId_specializationId: {
            userId: user.id,
            specializationId: spec.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          specializationId: spec.id,
        },
      });
    }
  }
}

async function ensureTickets(categories) {
  const admin = await getUserByEmail('admin@test.com');
  const tech1 = await getUserByEmail('tech1@test.com');
  const tech2 = await getUserByEmail('tech2@test.com');
  const tech3 = await getUserByEmail('tech3@test.com');
  const tech4 = await getUserByEmail('tech4@test.com');

  if (!admin) {
    throw new Error('admin@test.com not found');
  }

  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const items = [
    {
      requesterName: 'Магазин Север',
      requesterPhone: '+7 900 111-11-11',
      address: 'Москва, ул. Ленина, 10',
      pointName: 'Точка 01',
      problemCategoryName: 'Проблема с электрикой',
      problemText: 'Не работает свет в торговом зале.',
      urgency: TicketUrgency.URGENT,
      status: TicketStatus.NEW,
      slaMinutes: 120,
      assignedTechnicianId: null,
    },
    {
      requesterName: 'Кафе Вкус',
      requesterPhone: '+7 900 222-22-22',
      address: 'Москва, пр. Мира, 25',
      pointName: 'Кафе на Мира',
      problemCategoryName: 'Проблема с сантехникой',
      problemText: 'Течет труба под раковиной.',
      urgency: TicketUrgency.URGENT,
      status: TicketStatus.ASSIGNED,
      slaMinutes: 180,
      assignedTechnicianId: tech2 ? tech2.id : null,
    },
    {
      requesterName: 'Маркет Восток',
      requesterPhone: '+7 900 333-33-33',
      address: 'Москва, ул. Победы, 7',
      pointName: 'Точка 07',
      problemCategoryName: 'Проблема с холодильником',
      problemText: 'Холодильная витрина не держит температуру.',
      urgency: TicketUrgency.URGENT,
      status: TicketStatus.IN_PROGRESS,
      slaMinutes: 240,
      assignedTechnicianId: tech3 ? tech3.id : null,
    },
    {
      requesterName: 'Пекарня Хлеб',
      requesterPhone: '+7 900 444-44-44',
      address: 'Москва, ул. Садовая, 18',
      pointName: 'Пекарня',
      problemCategoryName: 'Проблема с кассой',
      problemText: 'Касса не печатает чек.',
      urgency: TicketUrgency.NOT_URGENT,
      status: TicketStatus.ASSIGNED,
      slaMinutes: 240,
      assignedTechnicianId: tech4 ? tech4.id : null,
    },
    {
      requesterName: 'Склад Юг',
      requesterPhone: '+7 900 555-55-55',
      address: 'Москва, Южная промзона, 3',
      pointName: 'Склад 3',
      problemCategoryName: 'Проблема с интернетом',
      problemText: 'Нет связи с интернетом и кассы офлайн.',
      urgency: TicketUrgency.URGENT,
      status: TicketStatus.NEW,
      slaMinutes: 90,
      assignedTechnicianId: null,
    },
    {
      requesterName: 'Офис Центр',
      requesterPhone: '+7 900 666-66-66',
      address: 'Москва, Тверская, 5',
      pointName: 'Офис',
      problemCategoryName: 'Проблема с кондиционером',
      problemText: 'Кондиционер не охлаждает помещение.',
      urgency: TicketUrgency.NOT_URGENT,
      status: TicketStatus.DONE,
      slaMinutes: 480,
      assignedTechnicianId: tech1 ? tech1.id : null,
    },
  ];

  for (const item of items) {
    const category = categoryByName.get(item.problemCategoryName);
    if (!category) continue;

    const existing = await prisma.ticket.findFirst({
      where: {
        companyId: admin.companyId,
        pointName: item.pointName,
        problemText: item.problemText,
      },
      select: { id: true },
    });

    const now = new Date();
    const dueAt =
      item.status === TicketStatus.DONE
        ? new Date(now.getTime() - 60 * 60 * 1000)
        : new Date(now.getTime() + (item.slaMinutes || 120) * 60 * 1000);

    let closedAt = null;
    if (item.status === TicketStatus.DONE) {
      closedAt = new Date(now.getTime() - 30 * 60 * 1000);
    }

    let ticket;

    if (existing) {
      ticket = await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          requesterName: item.requesterName,
          requesterPhone: item.requesterPhone,
          address: item.address,
          pointName: item.pointName,
          problemCategoryId: category.id,
          problemText: item.problemText,
          urgency: item.urgency,
          status: item.status,
          assignedTechnicianId: item.assignedTechnicianId,
          slaMinutes: item.slaMinutes,
          slaDueAt: dueAt,
          closedAt,
          statusUpdatedAt: now,
        },
      });
    } else {
      ticket = await prisma.ticket.create({
        data: {
          companyId: admin.companyId,
          requesterName: item.requesterName,
          requesterPhone: item.requesterPhone,
          address: item.address,
          pointName: item.pointName,
          problemCategoryId: category.id,
          problemText: item.problemText,
          urgency: item.urgency,
          status: item.status,
          assignedTechnicianId: item.assignedTechnicianId,
          slaMinutes: item.slaMinutes,
          slaDueAt: dueAt,
          closedAt,
          statusUpdatedAt: now,
        },
      });
    }

    const historyExists = await prisma.ticketStatusHistory.findFirst({
      where: { ticketId: ticket.id },
      select: { id: true },
    });

    if (!historyExists) {
      await prisma.ticketStatusHistory.create({
        data: {
          ticketId: ticket.id,
          fromStatus: null,
          toStatus: item.status,
          comment: 'Seed demo ticket',
          changedByUserId: admin.id,
        },
      });
    }
  }
}

async function main() {
  const company = await prisma.company.findUnique({
    where: { id: DEMO_COMPANY_ID },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error('Demo company not found. First run seed-users.js');
  }

  const specs = await ensureSpecializations(company.id);
  const categories = await ensureProblemCategories(company.id);

  await bindCategorySpecializations(categories, specs);
  await bindTechnicianSpecializations(specs);
  await ensureTickets(categories);

  const stats = {
    specializations: await prisma.specialization.count({
      where: { companyId: company.id },
    }),
    categories: await prisma.problemCategory.count({
      where: { companyId: company.id },
    }),
    tickets: await prisma.ticket.count({
      where: { companyId: company.id },
    }),
    technicians: await prisma.user.count({
      where: { companyId: company.id, role: UserRole.TECHNICIAN },
    }),
  };

  console.log('[seed-demo-data] done');
  console.log(`[seed-demo-data] company: ${company.name}`);
  console.log(`[seed-demo-data] specializations: ${stats.specializations}`);
  console.log(`[seed-demo-data] categories: ${stats.categories}`);
  console.log(`[seed-demo-data] technicians: ${stats.technicians}`);
  console.log(`[seed-demo-data] tickets: ${stats.tickets}`);
}

main()
  .catch((error) => {
    console.error('[seed-demo-data] failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
