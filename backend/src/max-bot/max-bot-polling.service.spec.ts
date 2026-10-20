import { MaxBotPollingService } from './max-bot-polling.service';

function makeMockService(overrides?: Partial<{ pollUpdates: jest.Mock; registerWebhook: jest.Mock }>) {
  return {
    pollUpdates: jest.fn().mockResolvedValue({ savedMarker: null, updates: [] }),
    registerWebhook: jest.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
}

describe('MaxBotPollingService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.MAX_BOT_COMMANDS_ENABLED;
    delete process.env.MAX_BOT_POLL_INTERVAL_MS;
    delete process.env.MAX_BOT_POLL_TIMEOUT_SECONDS;
    delete process.env.MAX_BOT_WEBHOOK_ENABLED;
    delete process.env.MAX_BOT_WEBHOOK_URL;
    delete process.env.MAX_BOT_WEBHOOK_SECRET;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('does not start polling when MAX_BOT_COMMANDS_ENABLED is absent', () => {
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    service.onModuleInit();
    jest.advanceTimersByTime(10_000);
    expect(mock.pollUpdates).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('does not start polling when MAX_BOT_COMMANDS_ENABLED=false', () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'false';
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    service.onModuleInit();
    jest.advanceTimersByTime(10_000);
    expect(mock.pollUpdates).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('polls on interval when MAX_BOT_COMMANDS_ENABLED=true', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_POLL_INTERVAL_MS = '1000';
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    service.onModuleInit();

    // Tick 1
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    // Tick 2 — first must finish (running=false) before second runs
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(mock.pollUpdates).toHaveBeenCalledTimes(3);
    service.onModuleDestroy();
  });

  it('passes timeout from env to pollUpdates', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_POLL_TIMEOUT_SECONDS = '7';
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    await (service as any).tick();
    expect(mock.pollUpdates).toHaveBeenCalledWith(expect.objectContaining({ timeout: 7 }));
  });

  it('starts with null marker and advances after first poll', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    const mock = makeMockService({
      pollUpdates: jest.fn()
        .mockResolvedValueOnce({ savedMarker: 50, updates: [] })
        .mockResolvedValueOnce({ savedMarker: 99, updates: [] }),
    });
    const service = new MaxBotPollingService(mock as any);

    await (service as any).tick();
    expect(mock.pollUpdates).toHaveBeenLastCalledWith(expect.objectContaining({ marker: null }));
    expect((service as any).marker).toBe(50);

    await (service as any).tick();
    expect(mock.pollUpdates).toHaveBeenLastCalledWith(expect.objectContaining({ marker: 50 }));
    expect((service as any).marker).toBe(99);
  });

  it('does not update marker when savedMarker is not a number', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    const mock = makeMockService({
      pollUpdates: jest.fn().mockResolvedValue({ savedMarker: null, updates: [] }),
    });
    const service = new MaxBotPollingService(mock as any);
    await (service as any).tick();
    expect((service as any).marker).toBeNull();
  });

  it('does not throw when pollUpdates rejects', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    const mock = makeMockService({
      pollUpdates: jest.fn().mockRejectedValue(new Error('network down')),
    });
    const service = new MaxBotPollingService(mock as any);
    await expect((service as any).tick()).resolves.toBeUndefined();
  });

  it('skips concurrent tick if previous is still running', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    let unblock: () => void;
    const slowPoll = new Promise<any>((res) => {
      unblock = () => res({ savedMarker: 1, updates: [] });
    });
    const mock = makeMockService({ pollUpdates: jest.fn().mockReturnValueOnce(slowPoll) });
    const service = new MaxBotPollingService(mock as any);

    const first = (service as any).tick();
    const second = (service as any).tick(); // should be skipped — running=true
    unblock!();
    await Promise.all([first, second]);

    expect(mock.pollUpdates).toHaveBeenCalledTimes(1);
  });

  it('clears interval on destroy', () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_POLL_INTERVAL_MS = '1000';
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    service.onModuleInit();
    service.onModuleDestroy();
    jest.advanceTimersByTime(5000);
    expect(mock.pollUpdates).not.toHaveBeenCalled();
  });

  it('does not start polling when webhook mode is active', () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_ENABLED = 'true';
    process.env.MAX_BOT_POLL_INTERVAL_MS = '1000';
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    service.onModuleInit();
    jest.advanceTimersByTime(10_000);
    expect(mock.pollUpdates).not.toHaveBeenCalled();
    service.onModuleDestroy();
  });

  it('registers webhook on startup when webhook mode is active', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_URL = 'https://api.example.com/max-bot/webhook';
    process.env.MAX_BOT_WEBHOOK_SECRET = 'my-secret';
    const mock = makeMockService();
    const service = new MaxBotPollingService(mock as any);
    service.onModuleInit();
    await Promise.resolve(); // flush registration promise
    await Promise.resolve();
    expect(mock.registerWebhook).toHaveBeenCalledWith({
      url: 'https://api.example.com/max-bot/webhook',
      secret: 'my-secret',
      updateTypes: ['message_created'],
    });
    service.onModuleDestroy();
  });

  it('resets running flag after error so next tick can proceed', async () => {
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    const mock = makeMockService({
      pollUpdates: jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ savedMarker: 10, updates: [] }),
    });
    const service = new MaxBotPollingService(mock as any);
    await (service as any).tick();
    await (service as any).tick();
    expect(mock.pollUpdates).toHaveBeenCalledTimes(2);
    expect((service as any).marker).toBe(10);
  });
});
