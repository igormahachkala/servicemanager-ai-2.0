import { createHash } from 'crypto';

export type MaxBotEnvSource =
  | 'MAX_BOT_API_BASE_URL'
  | 'MAX_PUBLIC_FRONTEND_URL'
  | 'FRONTEND_URL'
  | 'MAX_GROUP_CHAT_ID'
  | 'MAX_BOT_WEBHOOK_URL'
  | 'MAX_BOT_API_TOKEN'
  | 'missing'
  | 'default';

export type MaxBotRuntimeDiagnostics = {
  envSource: 'process.env';
  status: 'ok' | 'degraded';
  tokenPresent: boolean;
  tokenSha256Prefix: string | null;
  tokenSource: MaxBotEnvSource;
  baseUrlSource: MaxBotEnvSource;
  frontendUrlSource: MaxBotEnvSource;
  groupChatIdSource: MaxBotEnvSource;
  webhookUrlSource: MaxBotEnvSource;
  commandsEnabled: boolean;
  webhookEnabled: boolean;
  issues: string[];
};

function sha256Prefix(value: string, length = 12) {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, length);
}

function normalize(value?: string | null) {
  return (value || '').trim();
}

export function getMaxBotRuntimeDiagnostics(): MaxBotRuntimeDiagnostics {
  const token = normalize(process.env.MAX_BOT_API_TOKEN);
  const baseUrl = normalize(process.env.MAX_BOT_API_BASE_URL);
  const frontendPublicUrl = normalize(process.env.MAX_PUBLIC_FRONTEND_URL);
  const frontendUrl = normalize(process.env.FRONTEND_URL);
  const groupChatId = normalize(process.env.MAX_GROUP_CHAT_ID);
  const webhookUrl = normalize(process.env.MAX_BOT_WEBHOOK_URL);
  const commandsEnabled = process.env.MAX_BOT_COMMANDS_ENABLED === 'true';
  const webhookEnabled = process.env.MAX_BOT_WEBHOOK_ENABLED === 'true';

  const issues: string[] = [];
  if (commandsEnabled && !token) {
    issues.push('MAX_BOT_API_TOKEN missing while MAX_BOT_COMMANDS_ENABLED=true');
  }
  if (webhookEnabled && !token) {
    issues.push('MAX_BOT_API_TOKEN missing while MAX_BOT_WEBHOOK_ENABLED=true');
  }
  if (webhookEnabled && !webhookUrl) {
    issues.push('MAX_BOT_WEBHOOK_URL missing while MAX_BOT_WEBHOOK_ENABLED=true');
  }
  if (commandsEnabled && !groupChatId) {
    issues.push('MAX_GROUP_CHAT_ID missing while MAX_BOT_COMMANDS_ENABLED=true');
  }

  return {
    envSource: 'process.env',
    status: issues.length > 0 ? 'degraded' : 'ok',
    tokenPresent: token.length > 0,
    tokenSha256Prefix: token ? sha256Prefix(token) : null,
    tokenSource: token ? 'MAX_BOT_API_TOKEN' : 'missing',
    baseUrlSource: baseUrl ? 'MAX_BOT_API_BASE_URL' : 'default',
    frontendUrlSource: frontendPublicUrl
      ? 'MAX_PUBLIC_FRONTEND_URL'
      : frontendUrl
        ? 'FRONTEND_URL'
        : 'missing',
    groupChatIdSource: groupChatId ? 'MAX_GROUP_CHAT_ID' : 'missing',
    webhookUrlSource: webhookUrl ? 'MAX_BOT_WEBHOOK_URL' : 'missing',
    commandsEnabled,
    webhookEnabled,
    issues,
  };
}

