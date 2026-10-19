import { describe, expect, it } from 'vitest'

import { PLANNER_ME_NEXT_CACHE, plannerMeNextQueryKey } from './plannerApi'

describe('plannerMeNextQueryKey', () => {
  it('разные клиенты — разные ключи', () => {
    expect(plannerMeNextQueryKey('client-a')).toEqual(['planner-me-next', 'client-a'])
    expect(plannerMeNextQueryKey('client-b')).toEqual(['planner-me-next', 'client-b'])
    expect(plannerMeNextQueryKey('client-a')).not.toEqual(plannerMeNextQueryKey('client-b'))
  })

  it('повтор того же клиента — тот же ключ (кэш без нового расчёта)', () => {
    expect(plannerMeNextQueryKey('client-a')).toEqual(plannerMeNextQueryKey(' client-a '))
  })

  it('кэш держится бесконечно до invalidate', () => {
    expect(PLANNER_ME_NEXT_CACHE.staleTime).toBe(Infinity)
    expect(PLANNER_ME_NEXT_CACHE.gcTime).toBe(Infinity)
    expect(PLANNER_ME_NEXT_CACHE.refetchOnMount).toBe(false)
    expect(PLANNER_ME_NEXT_CACHE.refetchOnWindowFocus).toBe(false)
  })
})
