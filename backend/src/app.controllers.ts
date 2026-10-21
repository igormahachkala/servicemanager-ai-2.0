import { AppController } from './app.controller';
import { DebugController } from './common/debug.controller';
import { HealthController } from './health.controller';
import { VersionController } from './version.controller';

export function appControllers(nodeEnv = process.env.NODE_ENV) {
  const controllers = [AppController, HealthController, VersionController];
  if (nodeEnv !== 'production') controllers.push(DebugController);
  return controllers;
}
