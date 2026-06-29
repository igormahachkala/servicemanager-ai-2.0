/**
 * Merges en.ts with existing ru.ts translations.
 * Preserves manually translated ru strings; fills gaps from VALUE_RU / PATH_RU.
 * Run: npx tsx scripts/build-ru.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { en } from '../src/i18n/en.ts';
import { ru as ruExisting } from '../src/i18n/ru.ts';
import { PATH_RU, STRICT_KEEP, VALUE_RU } from './ruTranslations.ts';
import { SUPPLEMENTAL_VALUE_RU } from './missingRuSupplement.ts';
import { PATH_RU_SUPPLEMENT } from './pathRuSupplement.ts';
import { FOCUS_LOCALIZATION_RU } from './focusLocalizationRu.ts';

function translate(path: string, value: string, existing: string | undefined): string {
  if (FOCUS_LOCALIZATION_RU[path]) return FOCUS_LOCALIZATION_RU[path];
  if (PATH_RU_SUPPLEMENT[path]) return PATH_RU_SUPPLEMENT[path];
  if (PATH_RU[path]) return PATH_RU[path];
  if (STRICT_KEEP.has(value)) return value;
  if (SUPPLEMENTAL_VALUE_RU[value]) return SUPPLEMENTAL_VALUE_RU[value];
  if (VALUE_RU[value]) return VALUE_RU[value];
  if (existing !== undefined && existing !== value) return existing;
  return value;
}

function deepMerge(
  enObj: unknown,
  ruObj: unknown,
  path: string[] = [],
): unknown {
  if (typeof enObj === 'string') {
    const existing = typeof ruObj === 'string' ? ruObj : undefined;
    return translate(path.join('.'), enObj, existing);
  }
  if (Array.isArray(enObj)) {
    return enObj.map((item, index) =>
      deepMerge(item, Array.isArray(ruObj) ? ruObj[index] : undefined, [...path, String(index)]),
    );
  }
  if (enObj && typeof enObj === 'object') {
    const ruRecord =
      ruObj && typeof ruObj === 'object' && !Array.isArray(ruObj)
        ? (ruObj as Record<string, unknown>)
        : {};
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(enObj as Record<string, unknown>)) {
      result[key] = deepMerge(val, ruRecord[key], [...path, key]);
    }
    return result;
  }
  return enObj;
}

const ru = deepMerge(en, ruExisting) as typeof en;

function serialize(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return `[\n${value.map((v) => `${padIn}${serialize(v, indent + 1)}`).join(',\n')}\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    return `{\n${entries
      .map(([k, v]) => {
        const key = /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(k) && !k.includes('-') ? k : JSON.stringify(k);
        return `${padIn}${key}: ${serialize(v, indent + 1)}`;
      })
      .join(',\n')}\n${pad}}`;
  }
  return String(value);
}

const header = `import type { Messages } from './en'

export const ru: Messages = `;

writeFileSync(new URL('../src/i18n/ru.ts', import.meta.url), `${header}${serialize(ru)}\n`);

// Audit
function flatten(obj: unknown, prefix = ''): [string, string][] {
  const result: [string, string][] = [];
  if (!obj || typeof obj !== 'object') return result;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') result.push([path, v]);
    else result.push(...flatten(v, path));
  }
  return result;
}

const enFlat = flatten(en);
const ruMap = new Map(flatten(ru));
const identical = enFlat.filter(([p, v]) => ruMap.get(p) === v && !STRICT_KEEP.has(v));
console.log(`ru.ts generated — ${identical.length} non-brand identical keys remain`);
if (identical.length > 0) {
  identical.slice(0, 20).forEach(([p, v]) => console.log('  missing:', p, '|', v.slice(0, 60)));
}
