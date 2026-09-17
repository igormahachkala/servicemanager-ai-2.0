import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { orderProblemCategories, reconcileCategorySelection } from './problemCategoryOrdering'

/**
 * SMA-OVERNIGHT-TICKET-UX-RECONCILIATION-122B — закрытие пробелов приёмки
 * по сроку выполнения и категории.
 *
 * Решения о выборе категории живут в чистом помощнике problemCategoryOrdering,
 * и его поведение проверяется вызовом. Но сам факт обращения экрана к этому
 * помощнику вызовом не проверить: обе формы создания — компоненты с
 * внутренними замыканиями, тестовой среды с DOM во фронтенде нет и она этой
 * задачей не заводится. Поэтому здесь стоит контракт по исходникам — тот же
 * приём, которым 121G проверяет мобильный экран ответа.
 *
 * Пробел в том, что прежняя форма подставляла первую категорию сама. Возврат
 * такой подстановки — не опечатка, а тихая потеря обязательного выбора:
 * заявка уедет с категорией, которую никто не называл.
 */

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (relative: string) => readFileSync(resolve(here, '..', relative), 'utf8')
const desktopCreate = () => readSrc('views/CreateTicketPage.tsx')
const mobileCreate = () => readSrc('mobile/MobileCreateTicket.tsx')

const CATEGORY_PLACEHOLDER = '<option value="">Выберите категорию</option>'

/** Любая подстановка категории из списка: первой, первой подходящей, любой. */
const AUTO_SELECT_PATTERNS = [
  /setCategoryId\(\s*activeCategories\[/,
  /setCategoryId\(\s*activeCategories\.\w+\(/,
  /setCategoryId\(\s*\w*[Ff]irst\w*\.id\s*\)/,
]

function assertNoAutoSelect(source: string, screen: string) {
  for (const pattern of AUTO_SELECT_PATTERNS) {
    expect(source, `${screen}: категория не должна подставляться сама (${pattern})`).not.toMatch(pattern)
  }
}

// ── 3. desktop: категория не выбирается сама ────────────────────────────────

describe('122B-3. форма создания на desktop не выбирает категорию сама', () => {
  it('категория начинается пустой и показывает подсказку выбора', () => {
    const source = desktopCreate()
    expect(source).toContain(CATEGORY_PLACEHOLDER)
    // Пустая строка — начальное состояние, а не «первая из списка».
    expect(source).toMatch(/useState\(''\)[^\n]*\n?/)
    expect(source).toMatch(/const \[categoryId, setCategoryId\] = useState\(''\)/)
  })

  it('согласование выбора идёт каноническим помощником, а не подстановкой первой', () => {
    const source = desktopCreate()
    expect(source).toMatch(/reconcileCategorySelection\(categoryId, activeCategories\)/)
    assertNoAutoSelect(source, 'desktop')
  })

  it('помощник согласования пустой выбор пустым и оставляет', () => {
    const categories = [{ id: 'hvac', name: 'Кондиционирование' }, { id: 'other', name: 'Другое' }]
    expect(reconcileCategorySelection('', categories)).toBe('')
    // Выпавшая из scope категория тоже не заменяется первой доступной.
    expect(reconcileCategorySelection('gone', categories)).toBe('')
  })
})

// ── 4. мобильная форма: категория не выбирается сама ───────────────────────

describe('122B-4. мобильная форма создания не выбирает категорию сама', () => {
  it('категория начинается пустой и показывает подсказку выбора', () => {
    const source = mobileCreate()
    expect(source).toContain(CATEGORY_PLACEHOLDER)
    expect(source).toMatch(/const \[categoryId, setCategoryId\] = useState\(''\)/)
  })

  it('согласование выбора идёт тем же помощником', () => {
    const source = mobileCreate()
    expect(source).toMatch(/reconcileCategorySelection\(categoryId, activeCategories\)/)
    assertNoAutoSelect(source, 'mobile')
  })

  it('недопустимая для техника категория очищается, а не подменяется подходящей', () => {
    const source = mobileCreate()
    // Прежнее поведение искало первую подходящую и ставило её молча.
    expect(source).not.toMatch(/categoryEligibleForTechnician\(row\)\s*\)\s*\n?\s*if \(firstOk\)/)
    expect(source).toMatch(/setCategoryId\(''\)/)
    // Пустой выбор не трогается вовсе: чистить нечего, подставлять нельзя.
    expect(source).toMatch(/if \(!isTechnician \|\| !categoryId\) return/)
  })
})

// ── 5. пустая категория не отправляется ────────────────────────────────────

describe('122B-5. пустая категория не даёт отправить форму', () => {
  it('desktop проверяет категорию до отправки и называет её точным текстом', () => {
    const source = desktopCreate()
    expect(source).toMatch(/if \(!payload\.categoryId\) return 'Выберите категорию'/)
    // Проверка стоит в том же validatePayload, который вызывается из onSubmit
    // до createM.mutate — иначе отказ пришёл бы уже с сервера.
    const validate = source.slice(source.indexOf('function validatePayload'))
    expect(validate.indexOf("return 'Выберите категорию'")).toBeGreaterThan(-1)
    const submit = source.slice(source.indexOf('function onSubmit'))
    expect(submit.indexOf('validatePayload(payload)')).toBeLessThan(submit.indexOf('createM.mutate(payload)'))
  })

  it('мобильная форма проверяет категорию до отправки и не считает выбор готовым без неё', () => {
    const source = mobileCreate()
    const create = source.slice(source.indexOf('function onCreate'))
    expect(create).toMatch(/if \(!locationId \|\| !categoryId\)/)
    expect(create).toMatch(/setError\('Выберите локацию и категорию'\)/)
    expect(create.indexOf('!categoryId')).toBeLessThan(create.indexOf('createM.mutate'))
    // Готовность выбора тоже требует категории — кнопка не включается раньше.
    const selectionReady = source.slice(source.indexOf('const selectionReady ='))
    expect(selectionReady.slice(0, 400)).toMatch(/!!categoryId/)
  })

  it('«Другое» и «Иной запрос» уходят в конец, но из списка не исчезают', () => {
    const categories = [
      { id: 'other', name: 'Другое' },
      { id: 'hvac', name: 'Кондиционирование' },
      { id: 'misc', name: 'Иной запрос' },
    ]
    expect(orderProblemCategories(categories).map((row) => row.id)).toEqual(['hvac', 'other', 'misc'])
    expect(orderProblemCategories(categories)).toHaveLength(3)
  })
})
