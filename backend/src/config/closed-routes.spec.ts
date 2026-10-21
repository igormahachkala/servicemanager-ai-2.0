import { isSwaggerEnabled } from './swagger';
import { DebugController } from '../common/debug.controller';
import { appControllers } from '../app.controllers';

describe('closed production routes', () => {
  it('leaves Swagger unmounted unless SWAGGER_ENABLED is true', () => {
    expect(isSwaggerEnabled('')).toBe(false);
    expect(isSwaggerEnabled(undefined)).toBe(false);
    expect(isSwaggerEnabled('true')).toBe(true);
  });

  it('omits DebugController when NODE_ENV is production', () => {
    expect(appControllers('production').some((item) => item === DebugController)).toBe(false);
    expect(appControllers('test').some((item) => item === DebugController)).toBe(true);
  });
});
