import { Prisma } from '@prisma/client'

/**
 * Нормализация подписи специализации для сравнения между tenant (провайдер vs клиент).
 */
export function normalizeSpecializationLabel(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** Варианты строки (trim + схлопывание пробелов) для перебора в Prisma `equals`. */
export function specializationNameMatchVariants(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  const collapsed = t.replace(/\s+/g, ' ').trim()
  return Array.from(new Set([t, collapsed].filter(Boolean)))
}

function buildSpecializationNameEqualsOrInput(names: string[]): Prisma.ProblemCategorySpecializationWhereInput | null {
  const branches: Prisma.ProblemCategorySpecializationWhereInput[] = []
  const seenInsensitive = new Set<string>()

  for (const raw of names) {
    if (typeof raw !== 'string') continue
    const t = raw.trim()
    if (!t) continue

    const candidates = new Set<string>()
    for (const v of specializationNameMatchVariants(t)) {
      candidates.add(v)
    }
    const norm = normalizeSpecializationLabel(t)
    if (norm) {
      candidates.add(norm)
    }

    for (const c of candidates) {
      const cTrim = c.trim()
      if (!cTrim.length) continue
      const dedupeKey = cTrim.toLowerCase()
      if (seenInsensitive.has(dedupeKey)) continue
      seenInsensitive.add(dedupeKey)
      branches.push({
        specialization: { name: { equals: cTrim, mode: 'insensitive' } },
      })
    }
  }

  if (branches.length === 0) return null
  return branches.length === 1 ? branches[0]! : { OR: branches }
}

/**
 * Условие `some` для связей категории со специализациями: совпадение по id техника
 * ИЛИ по имени (регистр не важен). Для имён используем только `equals` + `mode: insensitive`
 * (без `in` + `insensitive`, чтобы Prisma/драйвер не отклоняли запрос).
 */
export function buildSpecializationLinksSomeWhereInput(params: {
  specializationIds: string[]
  specializationNames: string[]
}): Prisma.ProblemCategorySpecializationWhereInput | null {
  const ids = Array.from(
    new Set(params.specializationIds.map((id) => (typeof id === 'string' ? id.trim() : '')).filter((id) => id.length > 0)),
  )

  const nameBlock = buildSpecializationNameEqualsOrInput(params.specializationNames ?? [])

  const orParts: Prisma.ProblemCategorySpecializationWhereInput[] = []
  if (ids.length > 0) {
    orParts.push({ specializationId: { in: ids } })
  }
  if (nameBlock) {
    orParts.push(nameBlock)
  }

  if (orParts.length === 0) {
    return null
  }
  return orParts.length === 1 ? orParts[0]! : { OR: orParts }
}

export function technicianMatchesCategorySpecializationLinks(params: {
  categoryLinks: { specializationId: string; specialization?: { name: string | null } | null }[]
  technicianSpecializationIds: string[]
  technicianSpecializationNames: string[]
}): boolean {
  const links = params.categoryLinks ?? []
  if (links.length === 0) {
    return true
  }
  const techIds = new Set(
    params.technicianSpecializationIds.map((id) => id.trim()).filter((id) => id.length > 0),
  )
  const techLabels = new Set(
    params.technicianSpecializationNames
      .map((n) => normalizeSpecializationLabel(n))
      .filter((n) => n.length > 0),
  )
  for (const link of links) {
    if (techIds.has(link.specializationId.trim())) {
      return true
    }
    const nm = normalizeSpecializationLabel(link.specialization?.name ?? '')
    if (nm && techLabels.has(nm)) {
      return true
    }
  }
  return false
}
