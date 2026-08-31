import { Injectable, Logger } from '@nestjs/common';
import { MaxUserBindingStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import {
  MAX_INIT_DATA_MAX_AGE_SECONDS,
  maxInitDataReplayDigest,
  verifyMaxInitData,
  type MaxInitDataRejectReason,
} from './max-init-data';

/**
 * SMA-MAX-SECURE-USER-BINDING-054.
 *
 * The binding ceremony: turns two independently proven identities into one link.
 *
 * Both halves must be proven in the same request, and neither half is ever taken on trust:
 *
 *   * the ServiceManager side is proven by the caller's authenticated session — the
 *     controller sits behind the same JwtAuthGuard as every other endpoint, so `userId`
 *     comes from a signed token, never from the request body;
 *   * the MAX side is proven by `initData`, verified against the bot token by
 *     `verifyMaxInitData`. A MAX user id is accepted only when it arrives inside a payload
 *     MAX itself signed.
 *
 * That is why there is no email challenge and no ticket challenge: a challenge proves the
 * user can read something, whereas the ceremony proves MAX and ServiceManager each already
 * authenticated the same person. Anything weaker — chat id, typed email, ticket number,
 * display name, MAX username — is a hint, and this file treats hints as worthless.
 *
 * The binding is an IDENTITY record and nothing more. It stores who, not what-they-may-do.
 * No permission, scope, role or tenant decision is made here or derived from it; callers
 * resolve an SMA user and then go through PBAC, Contract Context, location, specialization
 * and the tenant access resolver exactly as any other surface does.
 */

export type MaxBindingDenyReason =
  | `init_data_${MaxInitDataRejectReason}`
  | 'replayed'
  | 'user_not_found'
  | 'user_inactive'
  | 'user_already_bound'
  | 'max_user_already_bound';

export type MaxBindingView = {
  status: MaxUserBindingStatus;
  /** Masked. The full MAX id is an identifier of a real person and is never returned. */
  maxUserIdMasked: string;
  linkedAt: Date;
  lastVerifiedAt: Date | null;
};

export type MaxBindingResult =
  | { ok: true; created: boolean; binding: MaxBindingView }
  | { ok: false; reason: MaxBindingDenyReason };

export type MaxBindingRevokeResult = { ok: true; revoked: boolean };

@Injectable()
export class MaxBindingService {
  private readonly logger = new Logger(MaxBindingService.name);

  constructor(private readonly prisma: PrismaService) {}

  private get botToken(): string {
    return (process.env.MAX_BOT_API_TOKEN || '').trim();
  }

  /**
   * Create (or re-confirm) the binding for an already-authenticated ServiceManager user.
   *
   * `authenticatedUserId` MUST come from the verified session. Passing a body-supplied id
   * here would collapse the whole ceremony into "tell me who you are".
   */
  async createBinding(authenticatedUserId: string, initData: string): Promise<MaxBindingResult> {
    const verification = verifyMaxInitData(initData, this.botToken);
    if (!verification.valid) {
      // Reason only — never the payload, the signature or the token.
      this.logger.warn({ reason: verification.reason }, 'max_binding_init_data_rejected');
      return { ok: false, reason: `init_data_${verification.reason}` };
    }

    const { maxUserId, hash, authDate } = verification.data;

    // Single-use consumption. MAX documents no replay protection, so we add it: a payload
    // that verified once can never verify again. Without this, a captured initData could be
    // replayed by a different authenticated session to bind someone else's MAX identity to
    // the attacker's account — after which the victim's bot traffic would resolve to the
    // attacker's ServiceManager user. The insert races safely: the unique constraint makes
    // the first writer win and every concurrent replay fail.
    const digest = maxInitDataReplayDigest(hash);
    const consumed = await this.consumeReplayDigest(digest, authDate);
    if (!consumed) {
      this.logger.warn({ maxUserId: maskMaxUserId(maxUserId) }, 'max_binding_replay_rejected');
      return { ok: false, reason: 'replayed' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authenticatedUserId },
      select: { id: true, companyId: true, isActive: true, deletedAt: true },
    });
    if (!user) return { ok: false, reason: 'user_not_found' };
    if (!user.isActive || user.deletedAt) return { ok: false, reason: 'user_inactive' };

    const [byMaxUser, byUser] = await Promise.all([
      this.prisma.maxUserBinding.findUnique({
        where: { maxUserId },
        select: { id: true, userId: true, status: true },
      }),
      this.prisma.maxUserBinding.findFirst({
        where: { userId: user.id, status: MaxUserBindingStatus.ACTIVE },
        select: { id: true, maxUserId: true },
      }),
    ]);

    // This MAX identity already belongs to somebody else and is still live. Re-pointing it
    // would silently transfer a person's bot session to another account, so it is refused;
    // the current owner must revoke first.
    if (byMaxUser && byMaxUser.userId !== user.id && byMaxUser.status === MaxUserBindingStatus.ACTIVE) {
      this.logger.warn({ maxUserId: maskMaxUserId(maxUserId) }, 'max_binding_max_user_taken');
      return { ok: false, reason: 'max_user_already_bound' };
    }

    // This ServiceManager user is already live against a different MAX account. Refused for
    // the mirror-image reason, and because silently switching would leave the old MAX
    // account resolving to nothing with no audit of when that happened.
    if (byUser && (!byMaxUser || byUser.id !== byMaxUser.id)) {
      return { ok: false, reason: 'user_already_bound' };
    }

    const now = new Date();

    if (byMaxUser) {
      // Same user re-confirming, or a previously revoked/suspended row being reclaimed.
      // Both identities were just proven, so reactivation is legitimate and recorded.
      const binding = await this.prisma.maxUserBinding.update({
        where: { id: byMaxUser.id },
        data: {
          userId: user.id,
          companyId: user.companyId,
          status: MaxUserBindingStatus.ACTIVE,
          lastVerifiedAt: now,
          ...(byMaxUser.status === MaxUserBindingStatus.ACTIVE ? {} : { linkedAt: now }),
        },
        select: { status: true, maxUserId: true, linkedAt: true, lastVerifiedAt: true },
      });
      this.logger.log(
        { maxUserId: maskMaxUserId(maxUserId), reactivated: byMaxUser.status !== MaxUserBindingStatus.ACTIVE },
        'max_binding_confirmed',
      );
      return { ok: true, created: false, binding: toView(binding) };
    }

    const binding = await this.prisma.maxUserBinding.create({
      data: {
        userId: user.id,
        companyId: user.companyId,
        maxUserId,
        status: MaxUserBindingStatus.ACTIVE,
        linkedAt: now,
        lastVerifiedAt: now,
      },
      select: { status: true, maxUserId: true, linkedAt: true, lastVerifiedAt: true },
    });
    this.logger.log({ maxUserId: maskMaxUserId(maxUserId) }, 'max_binding_created');
    return { ok: true, created: true, binding: toView(binding) };
  }

  /** Current binding for the authenticated user, masked. Null when there is none. */
  async getBinding(authenticatedUserId: string): Promise<MaxBindingView | null> {
    const binding = await this.prisma.maxUserBinding.findFirst({
      where: { userId: authenticatedUserId, status: { not: MaxUserBindingStatus.REVOKED } },
      select: { status: true, maxUserId: true, linkedAt: true, lastVerifiedAt: true },
      orderBy: { linkedAt: 'desc' },
    });
    return binding ? toView(binding) : null;
  }

  /**
   * Revoke. Idempotent: revoking when nothing is bound is a success with `revoked: false`,
   * so a client can always reach the "not bound" state without special-casing.
   *
   * The row is kept in REVOKED rather than deleted — the resolver must be able to tell
   * "this MAX account was deliberately unlinked" apart from "never seen", and deleting
   * would erase that distinction along with the audit trail.
   */
  async revokeBinding(authenticatedUserId: string): Promise<MaxBindingRevokeResult> {
    const result = await this.prisma.maxUserBinding.updateMany({
      where: { userId: authenticatedUserId, status: { not: MaxUserBindingStatus.REVOKED } },
      data: { status: MaxUserBindingStatus.REVOKED },
    });
    if (result.count > 0) this.logger.log({ count: result.count }, 'max_binding_revoked');
    return { ok: true, revoked: result.count > 0 };
  }

  /**
   * Records the payload digest, returning false when it was already used.
   *
   * Expiry is set from `auth_date` plus the freshness window: once a payload is too old to
   * be accepted anyway, its guard row carries no security value and can be swept.
   */
  private async consumeReplayDigest(digest: string, authDate: Date): Promise<boolean> {
    const expiresAt = new Date(authDate.getTime() + MAX_INIT_DATA_MAX_AGE_SECONDS * 1000);
    try {
      await this.prisma.maxInitDataNonce.create({ data: { digest, authDate, expiresAt } });
      return true;
    } catch {
      // Unique violation, or the guard table is unavailable. Both mean we cannot prove this
      // payload is unused, and an unprovable payload is treated as replayed. Fail closed.
      return false;
    }
  }

  /** Housekeeping for expired guard rows. Safe to call from a scheduler; not wired here. */
  async pruneExpiredReplayGuards(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.maxInitDataNonce.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }
}

function toView(binding: {
  status: MaxUserBindingStatus;
  maxUserId: string;
  linkedAt: Date;
  lastVerifiedAt: Date | null;
}): MaxBindingView {
  return {
    status: binding.status,
    maxUserIdMasked: maskMaxUserId(binding.maxUserId),
    linkedAt: binding.linkedAt,
    lastVerifiedAt: binding.lastVerifiedAt,
  };
}

/** Enough for a person to recognise their own account, not enough to enumerate others. */
export function maskMaxUserId(maxUserId: string): string {
  const value = (maxUserId ?? '').trim();
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}
