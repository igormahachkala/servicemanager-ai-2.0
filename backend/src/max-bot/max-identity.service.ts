import { Injectable, Logger } from '@nestjs/common';
import { MaxUserBindingStatus, UserRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

/**
 * SMA-MAX-BOT-V2-FOUNDATION-037.
 *
 * The single place that answers "which ServiceManager user is this MAX account?".
 *
 * Everything the bot may eventually show or do has to start here, because a MAX chat
 * carries no ServiceManager authority of its own. Before this service existed the bot's
 * only check was `chatId === MAX_GROUP_CHAT_ID`, which identifies a *room*, not a person —
 * it cannot answer "what may this user see", so it must never be used as an identity.
 *
 * Deliberate non-goals in this task:
 *   * No binding creation. There is no secure linking ceremony yet, and a weak one
 *     (email echo, ticket-number challenge, chat membership) would be worse than none:
 *     it would look like authentication while granting a stranger someone else's scope.
 *   * No permission logic. This resolver returns an identity. Capabilities come from the
 *     canonical permission and access services, never from a MAX-specific matrix.
 */

/** Why a MAX identity did not resolve. Callers render UX from this, never from raw errors. */
export type MaxIdentityDenyReason =
  | 'no_max_user_id'
  | 'not_bound'
  | 'binding_suspended'
  | 'binding_revoked'
  | 'user_inactive'
  | 'company_mismatch';

export type MaxIdentity =
  | { resolved: true; userId: string; companyId: string; role: UserRole; maxUserId: string }
  | { resolved: false; reason: MaxIdentityDenyReason };

/**
 * Extracts the MAX user id from an update. MAX places the sender on the message for
 * `message_created` and on the callback for `message_callback`; both are read here so a
 * future callback handler resolves identity through exactly this path.
 */
export function extractMaxUserId(update: unknown): string | null {
  if (!update || typeof update !== 'object') return null;
  const root = update as Record<string, unknown>;

  const fromCallback = readUserId(root.callback);
  if (fromCallback) return fromCallback;

  const message = root.message;
  if (message && typeof message === 'object') {
    const fromSender = readUserId((message as Record<string, unknown>).sender);
    if (fromSender) return fromSender;
    const fromFrom = readUserId((message as Record<string, unknown>).from);
    if (fromFrom) return fromFrom;
  }

  return readUserId(root.user);
}

function readUserId(holder: unknown): string | null {
  if (!holder || typeof holder !== 'object') return null;
  const record = holder as Record<string, unknown>;

  const nested = record.user;
  if (nested && typeof nested === 'object') {
    const fromNested = readUserId(nested);
    if (fromNested) return fromNested;
  }

  const raw = record.user_id ?? record.userId ?? record.id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

@Injectable()
export class MaxIdentityService {
  private readonly logger = new Logger(MaxIdentityService.name);

  /**
   * SMA-MAX-SECURE-USER-BINDING-054 turned this on.
   *
   * The precondition stated when this was `false` has now been met: `MaxBindingService`
   * implements a ceremony that proves possession of BOTH identities in one request — the
   * ServiceManager side by an authenticated session, the MAX side by `initData` verified
   * against the bot token per dev.max.ru/docs/webapps/validation, with a freshness window
   * and single-use consumption layered on top.
   *
   * This flag says bindings can now be created. It says nothing about what a bound user may
   * do: that remains entirely with PBAC, Contract Context and the tenant access resolver.
   */
  static readonly BINDING_CREATION_ENABLED = true;

  constructor(private readonly prisma?: PrismaService) {}

  /**
   * THE bot-facing identity contract. Everything the bot renders or acts upon starts here
   * and nowhere else — callbacks, menus and any future button handler all enter through
   * this one method, so there is exactly one place where a MAX update becomes an actor.
   *
   * Returns identity only. The caller takes the resolved user to the canonical permission
   * and access services; this resolver never decides scope, and there is deliberately no
   * MAX-specific permission or role matrix anywhere in this module.
   *
   * Fails closed on every uncertainty: no id, no binding, a binding that is not ACTIVE,
   * an inactive or deleted user, or a binding whose company no longer matches the user's.
   */
  async resolveMaxIdentity(update: unknown): Promise<MaxIdentity> {
    const maxUserId = extractMaxUserId(update);
    if (!maxUserId) return { resolved: false, reason: 'no_max_user_id' };
    return this.resolveByMaxUserId(maxUserId);
  }

  /** Back-compatible alias for {@link resolveMaxIdentity}. */
  async resolve(update: unknown): Promise<MaxIdentity> {
    return this.resolveMaxIdentity(update);
  }

  async resolveByMaxUserId(maxUserId: string): Promise<MaxIdentity> {
    const normalized = (maxUserId ?? '').trim();
    if (!normalized) return { resolved: false, reason: 'no_max_user_id' };
    if (!this.prisma) return { resolved: false, reason: 'not_bound' };

    const binding = await this.prisma.maxUserBinding.findUnique({
      where: { maxUserId: normalized },
      select: {
        status: true,
        userId: true,
        companyId: true,
        user: {
          select: { id: true, companyId: true, role: true, isActive: true, deletedAt: true },
        },
      },
    });

    if (!binding) return { resolved: false, reason: 'not_bound' };

    if (binding.status === MaxUserBindingStatus.REVOKED) {
      return { resolved: false, reason: 'binding_revoked' };
    }
    if (binding.status !== MaxUserBindingStatus.ACTIVE) {
      return { resolved: false, reason: 'binding_suspended' };
    }

    const user = binding.user;
    if (!user || !user.isActive || user.deletedAt) {
      return { resolved: false, reason: 'user_inactive' };
    }

    // A binding records the company it was created for. If the user has since moved
    // companies the binding no longer describes a valid tenant context, and continuing
    // would resolve a user into a tenant they may no longer belong to.
    if (user.companyId !== binding.companyId) {
      this.logger.warn(
        { maxUserId: normalized, bindingCompanyId: binding.companyId, userCompanyId: user.companyId },
        'max_identity_company_mismatch',
      );
      return { resolved: false, reason: 'company_mismatch' };
    }

    return {
      resolved: true,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      maxUserId: normalized,
    };
  }
}
