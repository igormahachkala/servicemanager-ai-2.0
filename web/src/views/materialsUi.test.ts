import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * SMA-MATERIALS-V0 — структура UI. Окружение тестов node, RTL нет: «renders»
 * проверяется по исходнику компонентов (как в locationCard.test.ts) плюс по
 * проводке маршрута/навигации. Поведенческая логика покрыта lib/materials.test.ts.
 */

const here = resolve(__dirname)
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8')
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const materialsPage = code(read('./MaterialsPage.tsx'))
const technicianMaterials = code(read('../components/materials/TechnicianMaterials.tsx'))
const router = code(read('../router.tsx'))
const navigation = code(read('../lib/navigation.ts'))
const routeMeta = code(read('../lib/managementRouteMeta.ts'))
const shell = code(read('../ui/Shell.tsx'))

describe('справочник материалов рендерится', () => {
  it('форма создания со всеми полями', () => {
    expect(materialsPage).toContain('+ Материал')
    expect(materialsPage).toMatch(/Название \*/)
    expect(materialsPage).toMatch(/Единица измерения \*/)
    expect(materialsPage).toContain('SKU')
    expect(materialsPage).toContain('Категория')
    expect(materialsPage).toContain('api.createMaterial')
  })

  it('валидация формы идёт через чистую функцию, а не ad-hoc', () => {
    expect(materialsPage).toContain('validateMaterialInput')
  })

  it('активация/деактивация есть, а удаления нет (материал остаётся в истории)', () => {
    expect(materialsPage).toContain('api.setMaterialStatus')
    expect(materialsPage).toMatch(/Деактивировать|Активировать/)
    // критично: справочник не удаляет материал
    expect(materialsPage).not.toContain('deleteMaterial')
  })

  it('статус материала отображается', () => {
    expect(materialsPage).toMatch(/Активен|Неактивен/)
  })
})

describe('карточка техника: остатки и история', () => {
  it('остатки техника рендерятся форматом остатка', () => {
    expect(technicianMaterials).toContain('technicianMaterialBalances')
    expect(technicianMaterials).toContain('formatBalance')
  })

  it('история движений рендерится', () => {
    expect(technicianMaterials).toContain('technicianMaterialMovements')
    expect(technicianMaterials).toContain('История')
    expect(technicianMaterials).toContain('formatMovementAmount')
  })

  it('виды движения различаются визуально через tone-класс', () => {
    expect(technicianMaterials).toContain('describeMovement')
    expect(technicianMaterials).toContain('materialsMovementRow--${visual.tone}')
  })
})

describe('выдача материала руководителем', () => {
  it('кнопка и форма выдачи с валидацией и остатком склада', () => {
    expect(technicianMaterials).toContain('+ Выдать материал')
    expect(technicianMaterials).toContain('validateIssueInput')
    expect(technicianMaterials).toContain('issueMaterialToTechnician')
    expect(technicianMaterials).toContain('materialCompanyStock')
  })

  it('форма выдачи видна только при canIssue (руководитель)', () => {
    expect(technicianMaterials).toContain('canIssue ? <IssueMaterialForm')
  })

  it('успех не подделывается: ошибка backend показывается как есть', () => {
    expect(technicianMaterials).toMatch(/onError[\s\S]*setErr/)
  })
})

describe('проводка маршрута и навигации', () => {
  it('маршрут /materials объявлен в management shell', () => {
    expect(router).toContain('path="materials"')
    expect(router).toContain('component={MaterialsPage}')
  })
  it('пункт меню «Материалы»', () => {
    expect(navigation).toContain("to: '/materials'")
    expect(navigation).toContain('Материалы')
  })
  it('route-meta в разделе настроек', () => {
    expect(routeMeta).toMatch(/path: '\/materials', section: 'settings'/)
  })
  it('видимость в Shell под management-гейтом (как у справочников)', () => {
    expect(shell).toContain("item.to === '/materials'")
    expect(shell).toContain("targetPath === '/materials'")
  })
})
