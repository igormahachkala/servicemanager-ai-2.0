import { requestClientIpOrNull, resolveRequestClientIp } from './client-ip'

describe('resolveRequestClientIp', () => {
  it('prefers X-Qrator-IP-Source over req.ip and spoofed X-Forwarded-For', () => {
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
    ).toBe('203.0.113.10')
  })

  it('uses req.ip when Curator header is absent and ignores X-Forwarded-For', () => {
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

  it('reads the first non-empty array value of X-Qrator-IP-Source', () => {
    expect(
      resolveRequestClientIp({
        headers: { 'x-qrator-ip-source': ['', '  198.51.100.20  '] },
        ip: '10.0.0.8',
      }),
    ).toBe('198.51.100.20')
  })
})
