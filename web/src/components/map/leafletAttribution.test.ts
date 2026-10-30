import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * На наших картах подписи Leaflet с флагом нет. Leaflet добавляет её
 * через префикс attribution control. Каждая карта отключает штатный
 * control и ставит свой с prefix={false}. Ниже проверка по исходникам:
 * окружение node, DOM нет.
 */

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(here, '..', '..')

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return listSourceFiles(full)
    return /\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

const mapFiles = listSourceFiles(srcRoot).filter((file) => readFileSync(file, 'utf8').includes('<MapContainer'))

describe('подпись Leaflet без флага', () => {
  it('карты в проекте есть', () => {
    expect(mapFiles.length).toBeGreaterThan(0)
  })

  it.each(mapFiles)('%s отключает префикс подписи', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toMatch(/<MapContainer[\s\S]*?attributionControl=\{false\}/)
    expect(src).toMatch(/<AttributionControl[^>]*prefix=\{false\}/)
  })

  it('стиль скрывает флаг подписи на случай карты без настройки', () => {
    const css = readFileSync(resolve(srcRoot, 'app.css'), 'utf8')
    expect(css).toMatch(/\.leaflet-attribution-flag\s*\{[^}]*display:\s*none/)
  })
})
