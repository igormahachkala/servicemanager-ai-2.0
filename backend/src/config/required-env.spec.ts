import { getRequiredEnv, getJwtSecret } from './required-env'

describe('getRequiredEnv', () => {
  const ORIG = process.env

  beforeEach(() => {
    process.env = { ...ORIG }
  })

  afterAll(() => {
    process.env = ORIG
  })

  it('returns the value when present', () => {
    process.env['TEST_VAR'] = 'hello'
    expect(getRequiredEnv('TEST_VAR')).toBe('hello')
  })

  it('trims surrounding whitespace', () => {
    process.env['TEST_VAR'] = '  trimmed  '
    expect(getRequiredEnv('TEST_VAR')).toBe('trimmed')
  })

  it('throws when variable is absent', () => {
    delete process.env['TEST_VAR']
    expect(() => getRequiredEnv('TEST_VAR')).toThrow(/TEST_VAR.*not set/i)
  })

  it('throws when variable is empty string', () => {
    process.env['TEST_VAR'] = ''
    expect(() => getRequiredEnv('TEST_VAR')).toThrow(/TEST_VAR.*not set/i)
  })

  it('throws when variable is whitespace only', () => {
    process.env['TEST_VAR'] = '   '
    expect(() => getRequiredEnv('TEST_VAR')).toThrow(/TEST_VAR.*not set/i)
  })

  it('throws when value is shorter than minLength', () => {
    process.env['TEST_VAR'] = 'short'
    expect(() => getRequiredEnv('TEST_VAR', { minLength: 32 })).toThrow(/at least 32 characters/i)
  })

  it('passes when value meets minLength exactly', () => {
    process.env['TEST_VAR'] = 'a'.repeat(32)
    expect(getRequiredEnv('TEST_VAR', { minLength: 32 })).toHaveLength(32)
  })
})

describe('getJwtSecret', () => {
  const ORIG = process.env

  beforeEach(() => {
    process.env = { ...ORIG }
  })

  afterAll(() => {
    process.env = ORIG
  })

  it('throws when JWT_SECRET is absent', () => {
    delete process.env['JWT_SECRET']
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET.*not set/i)
  })

  it('throws when JWT_SECRET is shorter than 32 chars', () => {
    process.env['JWT_SECRET'] = 'tooshort'
    expect(() => getJwtSecret()).toThrow(/at least 32 characters/i)
  })

  it('returns the secret when it is 32+ chars', () => {
    const strong = 'a'.repeat(32)
    process.env['JWT_SECRET'] = strong
    expect(getJwtSecret()).toBe(strong)
  })

  it('does not return a fallback — never returns dev_secret', () => {
    delete process.env['JWT_SECRET']
    expect(() => getJwtSecret()).toThrow()
    // Confirm the fallback string was not returned
    try {
      getJwtSecret()
    } catch {
      // expected
    }
    // If we got here without throwing, that's a bug — the test above already caught it
  })
})
