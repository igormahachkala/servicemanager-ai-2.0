import { requestClientIpOrNull, resolveRequestClientIp } from './client-ip'

describe('resolveRequestClientIp', () => {
  const previous = process.env.QRATOR_TRUSTED_PROXIES

  afterEach(() => {
    if (previous === undefined) delete process.env.QRATOR_TRUSTED_PROXIES
    else process.env.QRATOR_TRUSTED_PROXIES = previous
  })

  it('ignores X-Qrator-IP-Source when the peer is not a trusted proxy', () => {
    delete process.env.QRATOR_TRUSTED_PROXIES
    expect(
      resolveRequestClientIp({
        headers: {
          'x-qrator-ip-source': '203.0.113.10',
          'x-forwarded-for': '1.2.3.4, 10.0.0.1',
          'x-real-ip': '198.51.100.1',
        },
        ip: '10.0.0.8',
        socket: { remoteAddress: '172.18.0.1' },
      }),
    ).toBe('10.0.0.8')
  })

  it('accepts X-Qrator-IP-Source when the peer is a trusted proxy', () => {
    process.env.QRATOR_TRUSTED_PROXIES = '172.18.0.1, 10.1.1.1'
    expect(
      resolveRequestClientIp({
        headers: {
          'x-qrator-ip-source': '203.0.113.10',
          'x-forwarded-for': '1.2.3.4, 10.0.0.1',
          'x-real-ip': '198.51.100.1',
        },
        ip: '10.0.0.8',
        socket: { remoteAddress: '::ffff:172.18.0.1' },
      }),
    ).toBe('203.0.113.10')
  })

  it('uses req.ip when the Qrator header is absent and ignores X-Forwarded-For', () => {
    expect(
      resolveRequestClientIp({
        headers: {
          'x-forwarded-for': '1.2.3.4',
          'x-real-ip': '9.9.9.9',
        },
        ip: '10.0.0.8',
        socket: { remoteAddress: '172.18.0.1' },
      }),
    ).toBe('10.0.0.8')
  })

  it('falls back to socket address when req.ip is empty', () => {
    expect(
      resolveRequestClientIp({
        headers: { 'x-forwarded-for': '1.2.3.4' },
        ip: '',
        socket: { remoteAddress: '::ffff:172.18.0.1' },
      }),
    ).toBe('172.18.0.1')
  })

  it('returns unknown when nothing is present', () => {
    expect(resolveRequestClientIp({})).toBe('unknown')
    expect(requestClientIpOrNull({})).toBeNull()
  })

  it('reads the first non-empty array value only from a trusted peer', () => {
    delete process.env.QRATOR_TRUSTED_PROXIES
    expect(
      resolveRequestClientIp({
        headers: { 'x-qrator-ip-source': ['', '  198.51.100.20  '] },
        ip: '10.0.0.8',
        socket: { remoteAddress: '172.18.0.1' },
      }),
    ).toBe('10.0.0.8')

    process.env.QRATOR_TRUSTED_PROXIES = '172.18.0.1'
    expect(
      resolveRequestClientIp({
        headers: { 'x-qrator-ip-source': ['', '  198.51.100.20  '] },
        ip: '10.0.0.8',
        socket: { remoteAddress: '172.18.0.1' },
      }),
    ).toBe('198.51.100.20')
  })
})
