import { AuthController } from './auth.controller'
import { REFRESH_COOKIE_NAME } from './auth-token-policy'

function responseMock() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }
}

describe('AuthController refresh cookie contract', () => {
  const payload = {
    access_token: 'access-token',
    user: {
      id: 'user-1',
      email: 'tech@example.test',
      firstName: null,
      lastName: null,
      avatarUrl: null,
      phone: null,
      role: 'TECHNICIAN',
      companyId: 'company-1',
      companyName: 'Компания',
      isActive: true,
      canAccessEngineeringAgent: false,
    },
  }

  function makeController() {
    const auth = {
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      impersonate: jest.fn(),
      me: jest.fn(),
    }
    const limiter = {
      consume: jest.fn(),
    }
    return { controller: new AuthController(auth as any, limiter as any), auth, limiter }
  }

  beforeEach(() => {
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    delete process.env.NODE_ENV
  })

  it('sets refresh token only in an HttpOnly cookie on login and does not return it in JSON', async () => {
    const { controller, auth } = makeController()
    auth.login.mockResolvedValue({ payload, refreshToken: 'raw-refresh-token' })
    const res = responseMock()

    const result = await controller.login(
      { headers: { 'user-agent': 'iPhone PWA' } },
      res as any,
      { email: 'tech@example.test', password: 'pw' },
    )

    expect(result).toEqual(payload)
    expect(result).not.toHaveProperty('refreshToken')
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'raw-refresh-token',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/auth',
      }),
    )
  })

  it('rotates the HttpOnly refresh cookie on refresh', async () => {
    const { controller, auth } = makeController()
    auth.refresh.mockResolvedValue({ payload, refreshToken: 'next-refresh-token' })
    const res = responseMock()

    const result = await controller.refresh(
      { headers: { cookie: `${REFRESH_COOKIE_NAME}=old-refresh-token`, 'user-agent': 'Chrome Android' } },
      res as any,
    )

    expect(result).toEqual(payload)
    expect(auth.refresh).toHaveBeenCalledWith('old-refresh-token', { userAgent: 'Chrome Android' })
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'next-refresh-token',
      expect.objectContaining({ httpOnly: true, path: '/auth' }),
    )
  })

  it('revokes the current refresh session and clears the cookie on logout', async () => {
    const { controller, auth } = makeController()
    auth.logout.mockResolvedValue({ ok: true, revoked: 1 })
    const res = responseMock()

    await expect(
      controller.logout({ headers: { cookie: `${REFRESH_COOKIE_NAME}=logout-refresh-token` } }, res as any),
    ).resolves.toEqual({ ok: true, revoked: 1 })

    expect(auth.logout).toHaveBeenCalledWith('logout-refresh-token')
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/auth',
        maxAge: 0,
      }),
    )
  })
})
