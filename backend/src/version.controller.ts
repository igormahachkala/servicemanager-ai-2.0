import { Controller, Get } from '@nestjs/common';

const SERVICE_NAME = 'ServiceManager.AI';
const UNKNOWN = 'unknown';
const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const ENVIRONMENTS = new Set(['beta', 'prod']);

export interface VersionResponse {
  service: string;
  commitSha: string;
  environment: string;
}

function safeValue(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized ? normalized : UNKNOWN;
}

function safeCommitSha(value: string | undefined): string {
  const normalized = safeValue(value);
  return SHA_PATTERN.test(normalized) ? normalized : UNKNOWN;
}

function safeEnvironment(value: string | undefined): string {
  const normalized = safeValue(value).toLowerCase();
  return ENVIRONMENTS.has(normalized) ? normalized : UNKNOWN;
}

@Controller('version')
export class VersionController {
  @Get()
  getVersion(): VersionResponse {
    return {
      service: SERVICE_NAME,
      commitSha: safeCommitSha(process.env.SMA_RELEASE_COMMIT_SHA),
      environment: safeEnvironment(process.env.SMA_RELEASE_ENVIRONMENT),
    };
  }
}
