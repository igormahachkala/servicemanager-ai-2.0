import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Owner terminology decision: the user-facing Location entity is «Объект», not «Локация».
// Display strings only — technical names (Location, locationId, routes, API, enums) unchanged,
// and backend error-match keys must KEEP «Локация заявки недоступна» to match the server text.
const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

describe('location entity term localization → «Объект»', () => {
  it('ticket/location display labels use «Объект»', () => {
    expect(src('../components/ticket-card-v2/TicketContextPanel.tsx')).toContain('<b>Объект:</b>')
    expect(src('../components/ticket-card-v2/TicketSummaryPanel.tsx')).toContain('<b>Объект:</b>')
    expect(src('../components/ticket-card-v2/TicketChildTicketsPanel.tsx')).toContain('Объект не указан')
    expect(src('../components/locations/LocationForm.tsx')).toContain('Объект активен')
    expect(src('./ticketChat.ts')).toContain("locationId: 'Объект'")
    expect(src('../views/LocationsPage.tsx')).toContain('Объект «')
    expect(src('../views/LocationsPage.tsx')).toContain('Список объектов')
  })

  it('no user-facing «Локация/локаци…» entity label remains in representative files', () => {
    for (const p of [
      '../components/ticket-card-v2/TicketContextPanel.tsx',
      '../components/ticket-card-v2/TicketSummaryPanel.tsx',
      '../views/LocationsPage.tsx',
      '../views/CreateTicketPage.tsx',
      '../mobile/MobileInspectionStartPage.tsx',
    ]) expect(src(p)).not.toMatch(/Локаци|локаци/)
  })

  it('LocationsPage verb agreement is masculine for «Объект»', () => {
    const s = src('../views/LocationsPage.tsx')
    expect(s).toContain("verb: 'создан' | 'обновлён'")
    expect(s).not.toContain("'обновлена'")
  })

  it('backend error-match keys keep «Локация заявки недоступна» (NOT translated)', () => {
    expect(src('./ticketOperationalErrors.ts')).toContain("includes('Локация заявки недоступна')")
    expect(src('./claimAvailabilityHints.ts')).toContain("includes('Локация заявки недоступна')")
  })
})
