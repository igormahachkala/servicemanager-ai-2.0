import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Russification batch 2: the user-facing "почта" label/validation must use the
// established Russian standard «Эл. почта» / «эл. почты», not the English «Email».
// Code identifiers (technicianEmail, normalizeEmail, type="email", …) are NOT UI
// and are deliberately out of scope — these assertions target display text only.
const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

describe('email term localization (batch 2)', () => {
  it('EmployeesPage validation messages use the Russian email term', () => {
    const s = src('./EmployeesPage.tsx')
    expect(s).toContain('Эл. почта обязательна')
    expect(s).toContain('Некорректный формат эл. почты')
    expect(s).not.toContain("'Email обязателен'")
    expect(s).not.toContain('Некорректный формат email')
  })

  it('InspectionRunReportPage company contact label uses the Russian email term', () => {
    const s = src('./InspectionRunReportPage.tsx')
    expect(s).not.toContain('>Email: {')
    expect(s.match(/Эл\. почта: \{report\.document\.(executor|client)Company\.email/g) ?? []).toHaveLength(2)
  })
})
