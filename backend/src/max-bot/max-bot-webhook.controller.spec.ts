import { Logger, UnauthorizedException } from '@nestjs/common'

import { MaxBotWebhookController } from './max-bot-webhook.controller'

describe('MaxBotWebhookController secret', () => {
  const previous = process.env.MAX_BOT_WEBHOOK_SECRET

  afterEach(() => {
    if (previous === undefined) delete process.env.MAX_BOT_WEBHOOK_SECRET
    else process.env.MAX_BOT_WEBHOOK_SECRET = previous
    jest.restoreAllMocks()
  })

  function controller() {
    return new MaxBotWebhookController({ handleWebhookUpdate: jest.fn().mockResolvedValue(undefined) } as any)
  }

  it('returns 401 and logs a startup error when the secret is empty', async () => {
    delete process.env.MAX_BOT_WEBHOOK_SECRET
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    const webhook = controller()
    webhook.onModuleInit()
    expect(error).toHaveBeenCalledWith('MAX_BOT_WEBHOOK_SECRET is empty')
    await expect(webhook.handleWebhook({}, 'anything')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('returns 401 for a wrong secret and does not log the received value', async () => {
    process.env.MAX_BOT_WEBHOOK_SECRET = 'correct-secret'
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const webhook = controller()
    await expect(webhook.handleWebhook({}, 'wrong-secret')).rejects.toBeInstanceOf(UnauthorizedException)
    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).not.toContain('wrong-secret')
    expect(logged).not.toContain('correct-secret')
  })

  it('returns 200 for the correct secret', async () => {
    process.env.MAX_BOT_WEBHOOK_SECRET = 'correct-secret'
    const webhook = controller()
    await expect(webhook.handleWebhook({ update_type: 'message_created' }, 'correct-secret')).resolves.toEqual({
      ok: true,
    })
  })
})
