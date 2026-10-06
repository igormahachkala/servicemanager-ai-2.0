import { AssignmentEligibilityResolver } from '../assignment/assignment-eligibility.resolver';

describe('round location assignment candidates', () => {
  const all = [{ id: 'tech-1' }, { id: 'tech-2' }];
  const inScope = [{ id: 'tech-1' }];

  function makeResolver() {
    const resolver: any = Object.create(AssignmentEligibilityResolver.prototype);
    resolver.listAllTechnicians = jest.fn(async () => all);
    resolver.filterTechniciansByLocationBindings = jest.fn(async () => inScope);
    return resolver;
  }

  it('intersects employer executors with contract and location scope', async () => {
    const resolver = makeResolver();
    const result = await AssignmentEligibilityResolver.prototype.listLocationAssignableExecutors.call(resolver, {
      employerCompanyId: 'provider-1',
      scopeCompanyId: 'client-1',
      locationId: 'location-1',
    });

    expect(resolver.listAllTechnicians).toHaveBeenCalledWith(
      'provider-1',
      [],
      { fallbackToAllWhenNoSpecializations: true },
    );
    expect(resolver.filterTechniciansByLocationBindings).toHaveBeenCalledWith(
      all,
      'client-1',
      'location-1',
    );
    expect(result).toBe(inScope);
  });
});
