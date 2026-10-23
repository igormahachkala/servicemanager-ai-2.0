import { Prisma } from '@prisma/client';

/**
 * SMA-MOBILE-LONG-TERM-TICKETS — WHERE Prisma как фрагмент SQL.
 *
 * Зачем: правило долгосрочной заявки — разность двух колонок, Prisma её в WHERE
 * не выражает. Чтобы правило, COUNT и keyset-страница выполнялись в PostgreSQL,
 * а доступ при этом решал тот же resolveBoardWhere, его готовый WHERE
 * переводится в SQL здесь. Своей модели доступа тут нет: только перевод.
 *
 * Перевод закрытый: неизвестный оператор, поле или форма — ошибка, а не
 * пропуск условия. Пропущенное условие расширило бы выборку; ошибка — нет.
 * Имена таблиц и колонок берутся только из схемы Prisma (DMMF), значения идут
 * параметрами запроса.
 *
 * Семантика повторяет Prisma для PostgreSQL; совпадение выборок проверяется на
 * настоящей БД в test/long-term-tickets.e2e-spec.ts.
 */

type DmmfField =
  (typeof Prisma.dmmf.datamodel.models)[number]['fields'][number];
type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];

const SCALAR_OPERATORS = new Set([
  'equals',
  'in',
  'notIn',
  'not',
  'lt',
  'lte',
  'gt',
  'gte',
  'contains',
  'startsWith',
  'endsWith',
  'mode',
]);

const TO_ONE_OPERATORS = new Set(['is', 'isNot']);
const TO_MANY_OPERATORS = new Set(['some', 'none', 'every']);

export class UnsupportedWhereError extends Error {
  constructor(message: string) {
    super(`prisma-where-sql: ${message}`);
    this.name = 'UnsupportedWhereError';
  }
}

const TRUE = Prisma.sql`TRUE`;
const FALSE = Prisma.sql`FALSE`;

function modelOf(name: string): DmmfModel {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === name);
  if (!model) throw new UnsupportedWhereError(`unknown model ${name}`);
  return model;
}

function quoteIdent(name: string): string {
  // Имена приходят только из DMMF; кавычки внутри всё равно экранируются.
  return `"${name.replace(/"/g, '""')}"`;
}

function tableOf(model: DmmfModel): Prisma.Sql {
  return Prisma.raw(quoteIdent(model.dbName ?? model.name));
}

function columnOf(alias: string, field: DmmfField): Prisma.Sql {
  return Prisma.raw(
    `${quoteIdent(alias)}.${quoteIdent(field.dbName ?? field.name)}`,
  );
}

function fieldOf(model: DmmfModel, name: string): DmmfField {
  const field = model.fields.find((f) => f.name === name);
  if (!field) {
    throw new UnsupportedWhereError(`unknown field ${model.name}.${name}`);
  }
  return field;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/**
 * null — «условия нет»: так Prisma обходится с пустыми {} и AND: [] — они
 * просто отбрасываются. В AND это то же, что TRUE.
 */
type Condition = Prisma.Sql | null;

function and(parts: Condition[]): Condition {
  const present = parts.filter((part): part is Prisma.Sql => part !== null);
  if (present.length === 0) return null;
  if (present.length === 1) return present[0];
  return Prisma.sql`(${Prisma.join(present, ' AND ')})`;
}

/**
 * Пустой OR и пустой член OR Prisma трактует по-разному в зависимости от места:
 * на верхнем уровне OR: [] не сужает выборку, внутри связи — даёт пусто, а член
 * {} из OR выбрасывается (проверено на PostgreSQL в e2e). Повторять эти
 * особенности ненадёжно, поэтому такие формы — отказ, а не догадка.
 */
function or(parts: Condition[]): Prisma.Sql {
  if (parts.length === 0) throw new UnsupportedWhereError('empty OR');
  if (parts.some((part) => part === null)) {
    throw new UnsupportedWhereError('empty member of OR');
  }
  const present = parts as Prisma.Sql[];
  if (present.length === 1) return present[0];
  return Prisma.sql`(${Prisma.join(present, ' OR ')})`;
}

/** Значение колонки: enum-колонке нужен явный каст параметра. */
function valueOf(field: DmmfField, value: unknown): Prisma.Sql {
  if (field.isList) {
    throw new UnsupportedWhereError(`list field ${field.name}`);
  }
  if (value === null || value === undefined) {
    throw new UnsupportedWhereError(`null value for ${field.name}`);
  }
  switch (field.kind) {
    case 'enum':
      if (typeof value !== 'string') {
        throw new UnsupportedWhereError(`bad enum value for ${field.name}`);
      }
      return Prisma.sql`CAST(${value} AS ${Prisma.raw(quoteIdent(field.type))})`;
    case 'scalar':
      break;
    default:
      throw new UnsupportedWhereError(`not a scalar field ${field.name}`);
  }
  switch (field.type) {
    case 'String':
      if (typeof value !== 'string') {
        throw new UnsupportedWhereError(`bad string value for ${field.name}`);
      }
      return Prisma.sql`${value}`;
    case 'Int':
    case 'BigInt':
    case 'Float':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new UnsupportedWhereError(`bad number value for ${field.name}`);
      }
      return Prisma.sql`${value}`;
    case 'Boolean':
      if (typeof value !== 'boolean') {
        throw new UnsupportedWhereError(`bad boolean value for ${field.name}`);
      }
      return Prisma.sql`${value}`;
    case 'DateTime': {
      const date =
        value instanceof Date
          ? value
          : typeof value === 'string'
            ? new Date(value)
            : null;
      if (!date || Number.isNaN(date.getTime())) {
        throw new UnsupportedWhereError(`bad date value for ${field.name}`);
      }
      // Колонки DateTime — timestamp(3) без зоны, в них UTC. Строка ISO с Z,
      // приведённая к timestamp, не зависит от TimeZone сессии.
      return Prisma.sql`CAST(${date.toISOString()} AS timestamp(3))`;
    }
    default:
      throw new UnsupportedWhereError(
        `unsupported type ${field.type} for ${field.name}`,
      );
  }
}

/**
 * Prisma не экранирует % и _ в contains/startsWith/endsWith: они остаются
 * шаблонами LIKE. Повторяем это, чтобы выборка совпадала с Prisma.
 */
function likePattern(value: unknown, kind: string, field: DmmfField) {
  if (typeof value !== 'string') {
    throw new UnsupportedWhereError(`bad ${kind} value for ${field.name}`);
  }
  if (kind === 'contains') return `%${value}%`;
  if (kind === 'startsWith') return `${value}%`;
  return `%${value}`;
}

function scalarFilter(
  alias: string,
  field: DmmfField,
  filter: unknown,
): Condition {
  const column = columnOf(alias, field);
  if (filter === null) return Prisma.sql`${column} IS NULL`;
  if (!isPlainObject(filter)) {
    return Prisma.sql`${column} = ${valueOf(field, filter)}`;
  }

  for (const key of Object.keys(filter)) {
    if (!SCALAR_OPERATORS.has(key)) {
      throw new UnsupportedWhereError(`operator ${key} on ${field.name}`);
    }
  }
  const mode = filter.mode;
  if (mode !== undefined && mode !== 'insensitive' && mode !== 'default') {
    throw new UnsupportedWhereError(
      `mode ${JSON.stringify(mode)} on ${field.name}`,
    );
  }
  const insensitive = mode === 'insensitive';
  if (insensitive && field.type !== 'String') {
    throw new UnsupportedWhereError(`insensitive mode on ${field.name}`);
  }
  const fold = (sql: Prisma.Sql) =>
    insensitive ? Prisma.sql`LOWER(${sql})` : sql;

  const parts: Prisma.Sql[] = [];
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || key === 'mode') continue;
    switch (key) {
      case 'equals':
        parts.push(
          value === null
            ? Prisma.sql`${column} IS NULL`
            : Prisma.sql`${fold(column)} = ${fold(valueOf(field, value))}`,
        );
        break;
      case 'not':
        if (value === null) {
          parts.push(Prisma.sql`${column} IS NOT NULL`);
        } else if (isPlainObject(value)) {
          const inner = scalarFilter(alias, field, { ...value, mode });
          if (inner) parts.push(Prisma.sql`NOT (${inner})`);
        } else {
          parts.push(
            Prisma.sql`${fold(column)} <> ${fold(valueOf(field, value))}`,
          );
        }
        break;
      case 'in':
      case 'notIn': {
        if (!Array.isArray(value)) {
          throw new UnsupportedWhereError(`${key} needs an array`);
        }
        if (value.length === 0) {
          parts.push(key === 'in' ? FALSE : TRUE);
          break;
        }
        const list = Prisma.join(
          value.map((item) => fold(valueOf(field, item))),
        );
        parts.push(
          key === 'in'
            ? Prisma.sql`${fold(column)} IN (${list})`
            : Prisma.sql`${fold(column)} NOT IN (${list})`,
        );
        break;
      }
      case 'lt':
        parts.push(Prisma.sql`${column} < ${valueOf(field, value)}`);
        break;
      case 'lte':
        parts.push(Prisma.sql`${column} <= ${valueOf(field, value)}`);
        break;
      case 'gt':
        parts.push(Prisma.sql`${column} > ${valueOf(field, value)}`);
        break;
      case 'gte':
        parts.push(Prisma.sql`${column} >= ${valueOf(field, value)}`);
        break;
      case 'contains':
      case 'startsWith':
      case 'endsWith': {
        if (field.type !== 'String') {
          throw new UnsupportedWhereError(`${key} on ${field.name}`);
        }
        const pattern = likePattern(value, key, field);
        parts.push(
          insensitive
            ? Prisma.sql`${column} ILIKE ${pattern}`
            : Prisma.sql`${column} LIKE ${pattern}`,
        );
        break;
      }
    }
  }
  return and(parts);
}

/** Связь поля-отношения: какие колонки родителя равны каким колонкам ребёнка. */
function relationJoin(model: DmmfModel, field: DmmfField) {
  const target = modelOf(field.type);
  if (field.relationFromFields && field.relationFromFields.length > 0) {
    // FK на этой стороне.
    return {
      target,
      pairs: field.relationFromFields.map((from, index) => ({
        parent: fieldOf(model, from),
        child: fieldOf(target, field.relationToFields![index]),
      })),
    };
  }
  const back = target.fields.find(
    (f) =>
      f.relationName === field.relationName &&
      f.type === model.name &&
      f !== field &&
      (f.relationFromFields?.length ?? 0) > 0,
  );
  if (!back) {
    throw new UnsupportedWhereError(
      `relation ${model.name}.${field.name} without a foreign key`,
    );
  }
  return {
    target,
    pairs: back.relationFromFields!.map((from, index) => ({
      parent: fieldOf(model, back.relationToFields![index]),
      child: fieldOf(target, from),
    })),
  };
}

function relationFilter(
  model: DmmfModel,
  alias: string,
  field: DmmfField,
  filter: unknown,
  depth: number,
): Condition {
  const { target, pairs } = relationJoin(model, field);
  const childAlias = `${alias}_${depth}`;
  const link = and(
    pairs.map(
      ({ parent, child }) =>
        Prisma.sql`${columnOf(childAlias, child)} = ${columnOf(alias, parent)}`,
    ),
  );
  const exists = (where: unknown) =>
    Prisma.sql`EXISTS (SELECT 1 FROM ${tableOf(target)} AS ${Prisma.raw(
      quoteIdent(childAlias),
    )} WHERE ${link} AND ${compileWhere(target.name, where, childAlias, depth + 1)})`;
  // Пустой фильтр связи «к одному» Prisma отбрасывает целиком — вместе с
  // требованием, чтобы связь была. Это особенность, а не правило: отказ.
  const existsNonEmpty = (where: unknown) => {
    if (compileCondition(target.name, where, childAlias, depth + 1) === null) {
      throw new UnsupportedWhereError(`empty filter of relation ${field.name}`);
    }
    return exists(where);
  };

  if (field.isList) {
    if (!isPlainObject(filter)) {
      throw new UnsupportedWhereError(`list relation ${field.name} filter`);
    }
    const parts: Prisma.Sql[] = [];
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined) continue;
      if (!TO_MANY_OPERATORS.has(key)) {
        throw new UnsupportedWhereError(`operator ${key} on ${field.name}`);
      }
      if (key === 'some') parts.push(exists(value));
      if (key === 'none') parts.push(Prisma.sql`NOT ${exists(value)}`);
      if (key === 'every') {
        if (
          compileCondition(target.name, value, childAlias, depth + 1) === null
        ) {
          throw new UnsupportedWhereError(`empty every on ${field.name}`);
        }
        parts.push(Prisma.sql`NOT ${exists({ NOT: value })}`);
      }
    }
    if (parts.length === 0) {
      throw new UnsupportedWhereError(`empty filter of relation ${field.name}`);
    }
    return and(parts);
  }

  // Связи нет: для FK на этой стороне — FK пустой, иначе — нет ребёнка.
  const missing = (): Prisma.Sql =>
    field.relationFromFields && field.relationFromFields.length > 0
      ? Prisma.sql`(${Prisma.join(
          pairs.map(
            ({ parent }) => Prisma.sql`${columnOf(alias, parent)} IS NULL`,
          ),
          ' AND ',
        )})`
      : Prisma.sql`NOT ${exists({})}`;
  if (filter === null) return missing();
  if (!isPlainObject(filter)) {
    throw new UnsupportedWhereError(`relation ${field.name} filter`);
  }
  const keys = Object.keys(filter).filter((k) => filter[k] !== undefined);
  if (keys.length > 0 && keys.every((k) => TO_ONE_OPERATORS.has(k))) {
    const parts: Prisma.Sql[] = [];
    if (filter.is !== undefined) {
      parts.push(filter.is === null ? missing() : existsNonEmpty(filter.is));
    }
    if (filter.isNot !== undefined) {
      parts.push(
        filter.isNot === null
          ? Prisma.sql`NOT ${missing()}`
          : Prisma.sql`NOT ${existsNonEmpty(filter.isNot)}`,
      );
    }
    return and(parts);
  }
  if (keys.some((k) => TO_ONE_OPERATORS.has(k))) {
    throw new UnsupportedWhereError(`mixed relation filter on ${field.name}`);
  }
  return existsNonEmpty(filter);
}

function logicalList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * WHERE модели `modelName` как условие SQL над строкой с псевдонимом `alias`.
 * Ключи одного объекта — через AND, как в Prisma. Пустой WHERE — TRUE.
 */
export function compileWhere(
  modelName: string,
  where: unknown,
  alias: string,
  depth = 0,
): Prisma.Sql {
  return compileCondition(modelName, where, alias, depth) ?? TRUE;
}

function compileCondition(
  modelName: string,
  where: unknown,
  alias: string,
  depth: number,
): Condition {
  if (depth > 16) throw new UnsupportedWhereError('where is too deep');
  if (where === undefined) return null;
  if (!isPlainObject(where)) {
    throw new UnsupportedWhereError(`where of ${modelName} is not an object`);
  }
  const model = modelOf(modelName);
  const parts: Condition[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === 'AND') {
      parts.push(
        and(
          logicalList(value).map((w) =>
            compileCondition(modelName, w, alias, depth + 1),
          ),
        ),
      );
      continue;
    }
    if (key === 'OR') {
      if (!Array.isArray(value)) {
        throw new UnsupportedWhereError('OR needs an array');
      }
      parts.push(
        or(value.map((w) => compileCondition(modelName, w, alias, depth + 1))),
      );
      continue;
    }
    if (key === 'NOT') {
      // Пустой член NOT Prisma отбрасывает: NOT {} не сужает выборку.
      parts.push(
        and(
          logicalList(value).map((w) => {
            const inner = compileCondition(modelName, w, alias, depth + 1);
            return inner ? Prisma.sql`NOT (${inner})` : null;
          }),
        ),
      );
      continue;
    }
    const field = fieldOf(model, key);
    parts.push(
      field.kind === 'object'
        ? relationFilter(model, alias, field, value, depth + 1)
        : scalarFilter(alias, field, value),
    );
  }
  return and(parts);
}
