/**
 * Идемпотентная загрузка базового набора специализаций и категорий проблем для одной компании.
 *
 * Использование:
 *   dotenv -e .env -- npx ts-node scripts/seed-standard-catalog.ts
 *   COMPANY_ID=<uuid> dotenv -e .env -- npx ts-node scripts/seed-standard-catalog.ts
 *
 * Проверка:
 *   GET /specializations?companyId=... (через UI / curl с JWT)
 *   GET /problem-categories?companyId=...
 */

import { PrismaClient } from '@prisma/client';

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

/** Ровно эти 10 наименований специализаций (порядок фиксирован). */
export const STANDARD_SPECIALIZATION_NAMES = [
  'Сантехника',
  'Электрика',
  'Отопление',
  'Кондиционирование',
  'Вентиляция',
  'Оборудование кухни',
  'Холодильное оборудование',
  'Общестроительные работы',
  'Слаботочные системы (интернет, камеры)',
  'Другое',
] as const;

type SpecName = (typeof STANDARD_SPECIALIZATION_NAMES)[number];

/**
 * Категории: уникальное имя в рамках компании = «Специализация — кейс»,
 * чтобы не нарушать @@unique([companyId, name]) при совпадении формулировок (напр. «Протечка»).
 */
const STANDARD_CATEGORY_ROWS: { spec: SpecName; categoryTitle: string }[] = [
  { spec: 'Сантехника', categoryTitle: 'Протечка' },
  { spec: 'Сантехника', categoryTitle: 'Засор' },
  { spec: 'Сантехника', categoryTitle: 'Нет воды' },
  { spec: 'Сантехника', categoryTitle: 'Низкое давление' },
  { spec: 'Электрика', categoryTitle: 'Нет света' },
  { spec: 'Электрика', categoryTitle: 'Искрит' },
  { spec: 'Электрика', categoryTitle: 'Выбивает автомат' },
  { spec: 'Электрика', categoryTitle: 'Не работает розетка' },
  { spec: 'Отопление', categoryTitle: 'Не греет' },
  { spec: 'Отопление', categoryTitle: 'Шум' },
  { spec: 'Отопление', categoryTitle: 'Протечка' },
  { spec: 'Кондиционирование', categoryTitle: 'Не охлаждает' },
  { spec: 'Кондиционирование', categoryTitle: 'Течёт' },
  { spec: 'Кондиционирование', categoryTitle: 'Шумит' },
  { spec: 'Оборудование кухни', categoryTitle: 'Не включается' },
  { spec: 'Оборудование кухни', categoryTitle: 'Ошибка' },
  { spec: 'Оборудование кухни', categoryTitle: 'Не греет' },
  // Специализации без развернутого списка в ТЗ — одна универсальная категория на специализацию
  { spec: 'Вентиляция', categoryTitle: 'Общий запрос' },
  { spec: 'Холодильное оборудование', categoryTitle: 'Общий запрос' },
  { spec: 'Общестроительные работы', categoryTitle: 'Общий запрос' },
  { spec: 'Слаботочные системы (интернет, камеры)', categoryTitle: 'Общий запрос' },
  { spec: 'Другое', categoryTitle: 'Иной запрос' },
];

function fullCategoryName(spec: SpecName, title: string): string {
  return `${spec} — ${title}`;
}

async function ensureSpecialization(prisma: PrismaClient, companyId: string, name: string) {
  const found = await prisma.specialization.findFirst({
    where: { companyId, name },
    select: { id: true, name: true, isActive: true },
  });
  if (found) {
    if (!found.isActive) {
      await prisma.specialization.update({
        where: { id: found.id },
        data: { isActive: true },
      });
    }
    return found.id;
  }
  const created = await prisma.specialization.create({
    data: { companyId, name },
    select: { id: true },
  });
  return created.id;
}

async function ensureCategorySingleSpec(
  prisma: PrismaClient,
  params: {
    companyId: string;
    name: string;
    specializationId: string;
    instructions?: string | null;
  },
) {
  let category = await prisma.problemCategory.findFirst({
    where: { companyId: params.companyId, name: params.name },
    select: { id: true },
  });
  if (!category) {
    category = await prisma.problemCategory.create({
      data: {
        companyId: params.companyId,
        name: params.name,
        instructions: params.instructions ?? null,
        isActive: true,
      },
      select: { id: true },
    });
  } else if (params.instructions !== undefined) {
    await prisma.problemCategory.update({
      where: { id: category.id },
      data: { instructions: params.instructions },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.problemCategorySpecialization.deleteMany({
      where: { problemCategoryId: category!.id },
    });
    await tx.problemCategorySpecialization.create({
      data: {
        problemCategoryId: category!.id,
        specializationId: params.specializationId,
      },
    });
  });
}

/**
 * Создаёт недостающие специализации и категории, для каждой категории ровно одна связь specializationId.
 * Идемпотентно по имени специализации и полному имени категории в компании.
 */
export async function runStandardCatalogSeed(client: PrismaClient, companyId: string) {
  const cid = companyId.trim();
  const company = await client.company.findFirst({
    where: { id: cid },
    select: { id: true, name: true },
  });
  if (!company) {
    throw new Error(`Company not found: ${cid}`);
  }
  console.log(`[seed-catalog] company: ${company.name} (${company.id})`);

  const specIdByName = new Map<string, string>();
  for (const name of STANDARD_SPECIALIZATION_NAMES) {
    const id = await ensureSpecialization(client, cid, name);
    specIdByName.set(name, id);
    console.log(`[seed-catalog] specialization OK: ${name} → ${id}`);
  }

  for (const row of STANDARD_CATEGORY_ROWS) {
    const specId = specIdByName.get(row.spec);
    if (!specId) throw new Error(`internal: missing spec ${row.spec}`);
    const name = fullCategoryName(row.spec, row.categoryTitle);
    await ensureCategorySingleSpec(client, {
      companyId: cid,
      name,
      specializationId: specId,
    });
    console.log(`[seed-catalog] category OK: ${name}`);
  }

  for (const name of STANDARD_SPECIALIZATION_NAMES) {
    const s = await client.specialization.findFirst({
      where: { companyId: cid, name },
      select: { id: true },
    });
    if (!s) throw new Error(`[seed-catalog] missing specialization: ${name}`);
  }

  for (const row of STANDARD_CATEGORY_ROWS) {
    const name = fullCategoryName(row.spec, row.categoryTitle);
    const cat = await client.problemCategory.findFirst({
      where: { companyId: cid, name },
      include: { specializationLinks: { select: { specializationId: true } } },
    });
    if (!cat) throw new Error(`[seed-catalog] missing category: ${name}`);
    if (cat.specializationLinks.length !== 1) {
      throw new Error(`[seed-catalog] category must have exactly one specialization: ${name}`);
    }
    const wantSpec = specIdByName.get(row.spec);
    if (cat.specializationLinks[0]!.specializationId !== wantSpec) {
      throw new Error(`[seed-catalog] wrong specialization link for: ${name}`);
    }
  }

  const specCount = await client.specialization.count({ where: { companyId: cid } });
  const catCount = await client.problemCategory.count({ where: { companyId: cid } });

  console.log(
    `[seed-catalog] done: ${STANDARD_SPECIALIZATION_NAMES.length} standard specializations ensured; ` +
      `${STANDARD_CATEGORY_ROWS.length} standard categories 1:1; company has ${specCount} spec rows, ${catCount} category rows total.`,
  );
  console.log(
    '[seed-catalog] API: GET /specializations (JWT company) — GET /problem-categories?companyId=<client> при linked-контексте.',
  );
}

async function main() {
  const prisma = new PrismaClient();
  const companyId = (process.env.COMPANY_ID || DEMO_COMPANY_ID).trim();
  try {
    await runStandardCatalogSeed(prisma, companyId);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('[seed-catalog] failed', e);
  process.exit(1);
});
