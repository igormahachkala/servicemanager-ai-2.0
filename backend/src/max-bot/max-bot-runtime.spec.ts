import { getMaxBotRuntimeDiagnostics } from './max-bot-runtime';

describe('getMaxBotRuntimeDiagnostics', () => {
  const envBackup = {
    MAX_BOT_API_BASE_URL: process.env.MAX_BOT_API_BASE_URL,
    MAX_PUBLIC_FRONTEND_URL: process.env.MAX_PUBLIC_FRONTEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    MAX_GROUP_CHAT_ID: process.env.MAX_GROUP_CHAT_ID,
    MAX_BOT_API_TOKEN: process.env.MAX_BOT_API_TOKEN,
    MAX_BOT_COMMANDS_ENABLED: process.env.MAX_BOT_COMMANDS_ENABLED,
    MAX_BOT_WEBHOOK_ENABLED: process.env.MAX_BOT_WEBHOOK_ENABLED,
    MAX_BOT_WEBHOOK_URL: process.env.MAX_BOT_WEBHOOK_URL,
  };

  const restore = (key: keyof typeof envBackup) => {
    const value = envBackup[key];
    if (typeof value === 'string') {
      process.env[key] = value;
      return;
    }
    delete process.env[key];
  };

  afterEach(() => {
    restore('MAX_BOT_API_BASE_URL');
    restore('MAX_PUBLIC_FRONTEND_URL');
    restore('FRONTEND_URL');
    restore('MAX_GROUP_CHAT_ID');
    restore('MAX_BOT_API_TOKEN');
    restore('MAX_BOT_COMMANDS_ENABLED');
    restore('MAX_BOT_WEBHOOK_ENABLED');
    restore('MAX_BOT_WEBHOOK_URL');
  });

  it('exposes sources and a non-secret sha prefix when token is configured', () => {
    process.env.MAX_BOT_API_BASE_URL = 'https://platform-api.max.ru';
    process.env.MAX_PUBLIC_FRONTEND_URL = 'https://servicemanagerai.ru/';
    process.env.MAX_GROUP_CHAT_ID = '-75137613795359';
    process.env.MAX_BOT_API_TOKEN = 'super-secret-token';
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_ENABLED = 'true';
    process.env.MAX_BOT_WEBHOOK_URL = 'https://api.servicemanagerai.ru/max-bot/webhook';

    const diagnostics = getMaxBotRuntimeDiagnostics();

    expect(diagnostics.status).toBe('ok');
    expect(diagnostics.tokenPresent).toBe(true);
    expect(diagnostics.tokenSha256Prefix).toHaveLength(12);
    expect(diagnostics.tokenSha256Prefix).not.toContain('super-secret-token');
    expect(diagnostics.tokenSource).toBe('MAX_BOT_API_TOKEN');
    expect(diagnostics.frontendUrlSource).toBe('MAX_PUBLIC_FRONTEND_URL');
    expect(diagnostics.groupChatIdSource).toBe('MAX_GROUP_CHAT_ID');
    expect(diagnostics.webhookUrlSource).toBe('MAX_BOT_WEBHOOK_URL');
  });

  it('marks diagnostics degraded when commands are enabled without a token', () => {
    delete process.env.MAX_BOT_API_TOKEN;
    process.env.MAX_BOT_COMMANDS_ENABLED = 'true';
    delete process.env.MAX_BOT_WEBHOOK_ENABLED;
    delete process.env.MAX_BOT_WEBHOOK_URL;

    const diagnostics = getMaxBotRuntimeDiagnostics();

    expect(diagnostics.status).toBe('degraded');
    expect(diagnostics.tokenPresent).toBe(false);
    expect(diagnostics.tokenSha256Prefix).toBeNull();
    expect(diagnostics.issues).toContain('MAX_BOT_API_TOKEN missing while MAX_BOT_COMMANDS_ENABLED=true');
  });
});
