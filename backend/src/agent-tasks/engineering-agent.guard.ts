import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import { isEngineeringAgentOwner } from './agent-tasks.access'

/**
 * Restricts a route to Engineering Agent owners. Must run AFTER JwtAuthGuard so
 * `request.user` is populated. Hides existence of the module from everyone else.
 */
@Injectable()
export class EngineeringAgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request?.user
    if (!user || !isEngineeringAgentOwner({ role: user.role, email: user.email })) {
      throw new ForbiddenException('Engineering Agent module is not available')
    }
    return true
  }
}
