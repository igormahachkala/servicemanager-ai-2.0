import {
  matchCategorySpecializationLinks,
  technicianMatchesCategorySpecializationLinks,
} from './ticket-specialization-match.utils'

describe('assignment specialization matching', () => {
  it('matches by specialization id in same-tenant case', () => {
    const categoryLinks = [{ specializationId: 'spec-1', specialization: { name: 'Сантехника' } }]
    const matched = matchCategorySpecializationLinks({
      categoryLinks,
      technicianSpecializationIds: ['spec-1'],
      technicianSpecializationNames: [],
    })
    expect(matched).toEqual(['сантехника'])
    expect(
      technicianMatchesCategorySpecializationLinks({
        categoryLinks,
        technicianSpecializationIds: ['spec-1'],
        technicianSpecializationNames: [],
      }),
    ).toBe(true)
  })

  it('matches by normalized name when cross-tenant ids differ', () => {
    const categoryLinks = [{ specializationId: 'client-spec-1', specialization: { name: 'Сантехника' } }]
    const matched = matchCategorySpecializationLinks({
      categoryLinks,
      technicianSpecializationIds: ['provider-spec-9'],
      technicianSpecializationNames: ['  сантехника  '],
    })
    expect(matched).toEqual(['сантехника'])
  })

  it('does not match when neither id nor normalized name match', () => {
    const categoryLinks = [{ specializationId: 'client-spec-1', specialization: { name: 'Сантехника' } }]
    expect(
      technicianMatchesCategorySpecializationLinks({
        categoryLinks,
        technicianSpecializationIds: ['provider-spec-9'],
        technicianSpecializationNames: ['Электрика'],
      }),
    ).toBe(false)
  })
})

