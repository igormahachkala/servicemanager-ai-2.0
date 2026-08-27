import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ServiceContractRole, UserRole } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';

import { PrismaService } from '../prisma/prisma.service';
import { getJwtSecret } from '../config/required-env';
import { isServiceContractEffective } from '../service-contracts/service-contract-window';
import { buildLegacyNotificationNavigationTarget } from '../notifications/notification-navigation';

type RealtimeUser = {
  id: string;
  email: string;
  companyId: string;
  role: UserRole;
};

type RealtimeSubscription = {
  id: string;
  scope: 'board' | 'notifications';
  targetCompanyId: string;
  linkedClientCompanyId: string | null;
  observerCompanyId: string | null;
};

type RealtimeClient = {
  id: string;
  socket: Socket;
  receiveBuffer: Buffer;
  subscriptions: Map<string, RealtimeSubscription>;
  user: RealtimeUser | null;
  authTimer: NodeJS.Timeout | null;
  closed: boolean;
};

type DomainEventRow = {
  id: string;
  companyId: string;
  entityType: string;
  entityId: string;
  type: string;
  actorUserId: string | null;
  createdAt: Date;
};

type NotificationRow = {
  id: string;
  companyId: string;
  userId: string;
  type: string;
  entityType: string;
  entityId: string;
  linkedClientCompanyId: string | null;
  navigationTarget: unknown | null;
  createdAt: Date;
};

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly clients = new Map<string, RealtimeClient>();
  private readonly authTimeoutMs = this.envNumber('REALTIME_AUTH_TIMEOUT_MS', 1500);
  private readonly maxPayloadBytes = this.envNumber('REALTIME_MAX_FRAME_BYTES', 1024 * 1024);
  private readonly pollMs = this.envNumber('REALTIME_POLL_MS', 500);
  private readonly seenDomainEventIds: string[] = [];
  private readonly seenDomainEventSet = new Set<string>();
  private readonly seenNotificationIds: string[] = [];
  private readonly seenNotificationSet = new Set<string>();

  private attachedServer: HttpServer | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private pollInFlight = false;
  private domainCursor = new Date(Date.now() - 1000);
  private notificationCursor = new Date(Date.now() - 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  onModuleInit() {
    this.pollTimer = setInterval(() => {
      void this.pollRealtimeEvents();
    }, this.pollMs);
    this.pollTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    for (const client of this.clients.values()) {
      this.closeClient(client, 1001, 'Server shutting down');
    }
  }

  attach(server: HttpServer) {
    if (this.attachedServer === server) return;

    if (this.attachedServer) {
      this.logger.warn('Realtime WebSocket server is already attached');
      return;
    }

    this.attachedServer = server;
    server.on('upgrade', (request, socket, head) => {
      this.handleUpgrade(request, socket as Socket, head);
    });
    this.logger.log('Realtime WebSocket upgrade bound at /ws');
  }

  private handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer) {
    const parsed = this.parseRequestUrl(request);
    if (!parsed || parsed.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const key = request.headers['sec-websocket-key'];
    if (!key || Array.isArray(key)) {
      this.rejectUpgrade(socket, 400, 'Bad WebSocket key');
      return;
    }

    const upgrade = String(request.headers.upgrade || '').toLowerCase();
    if (upgrade !== 'websocket') {
      this.rejectUpgrade(socket, 400, 'Expected WebSocket upgrade');
      return;
    }

    const accept = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    socket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${accept}`,
        '\r\n',
      ].join('\r\n'),
    );

    const client = this.createClient(socket);
    const token = this.extractHandshakeToken(request, parsed);

    socket.on('data', (chunk) => this.handleSocketData(client, chunk));
    socket.on('close', () => this.cleanupClient(client));
    socket.on('error', () => this.cleanupClient(client));

    if (head.length > 0) {
      this.handleSocketData(client, head);
    }

    if (token) {
      void this.authenticateClient(client, token);
      return;
    }

    client.authTimer = setTimeout(() => {
      if (client.user || client.closed) return;
      this.send(client, {
        type: 'AUTH_REQUIRED',
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required',
      });
      this.closeClient(client, 1008, 'Authentication token required');
    }, this.authTimeoutMs);
    client.authTimer.unref?.();
  }

  private createClient(socket: Socket): RealtimeClient {
    const client: RealtimeClient = {
      id: randomUUID(),
      socket,
      receiveBuffer: Buffer.alloc(0),
      subscriptions: new Map(),
      user: null,
      authTimer: null,
      closed: false,
    };
    this.clients.set(client.id, client);
    return client;
  }

  private rejectUpgrade(socket: Socket, status: number, message: string) {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }

  private parseRequestUrl(request: IncomingMessage) {
    try {
      return new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    } catch {
      return null;
    }
  }

  private extractHandshakeToken(request: IncomingMessage, parsed: URL) {
    const queryToken = parsed.searchParams.get('token') || parsed.searchParams.get('access_token');
    if (queryToken) return queryToken.trim();

    const auth = request.headers.authorization;
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
      return auth.slice(7).trim();
    }

    const protocol = request.headers['sec-websocket-protocol'];
    const protocols = (Array.isArray(protocol) ? protocol.join(',') : protocol || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    for (const value of protocols) {
      if (value.toLowerCase().startsWith('bearer.')) return value.slice(7).trim();
      if (value.toLowerCase().startsWith('jwt.')) return value.slice(4).trim();
    }

    return '';
  }

  private handleSocketData(client: RealtimeClient, chunk: Buffer) {
    if (client.closed) return;
    client.receiveBuffer = Buffer.concat([client.receiveBuffer, chunk]);

    while (client.receiveBuffer.length >= 2) {
      const first = client.receiveBuffer[0];
      const second = client.receiveBuffer[1];
      const fin = (first & 0x80) !== 0;
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let payloadLength = second & 0x7f;
      let offset = 2;

      if (!fin) {
        this.closeClient(client, 1003, 'Fragmented frames are not supported');
        return;
      }

      if (payloadLength === 126) {
        if (client.receiveBuffer.length < offset + 2) return;
        payloadLength = client.receiveBuffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (client.receiveBuffer.length < offset + 8) return;
        const bigLength = client.receiveBuffer.readBigUInt64BE(offset);
        if (bigLength > BigInt(this.maxPayloadBytes)) {
          this.closeClient(client, 1009, 'Frame too large');
          return;
        }
        payloadLength = Number(bigLength);
        offset += 8;
      }

      if (payloadLength > this.maxPayloadBytes) {
        this.closeClient(client, 1009, 'Frame too large');
        return;
      }

      if (!masked) {
        this.closeClient(client, 1002, 'Client frames must be masked');
        return;
      }

      if (client.receiveBuffer.length < offset + 4 + payloadLength) return;

      const mask = client.receiveBuffer.subarray(offset, offset + 4);
      offset += 4;
      const maskedPayload = client.receiveBuffer.subarray(offset, offset + payloadLength);
      const payload = Buffer.alloc(payloadLength);
      for (let i = 0; i < payloadLength; i += 1) {
        payload[i] = maskedPayload[i] ^ mask[i % 4];
      }

      client.receiveBuffer = client.receiveBuffer.subarray(offset + payloadLength);

      if (opcode === 0x8) {
        this.closeClient(client, 1000, 'Client closed');
        return;
      }

      if (opcode === 0x9) {
        this.writeFrame(client, payload, 0x0a);
        continue;
      }

      if (opcode !== 0x1) {
        this.closeClient(client, 1003, 'Only text frames are supported');
        return;
      }

      void this.handleClientMessage(client, payload.toString('utf8'));
    }
  }

  private async handleClientMessage(client: RealtimeClient, raw: string) {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      this.send(client, {
        type: 'BAD_MESSAGE',
        code: 'BAD_MESSAGE',
        message: 'Message must be JSON',
      });
      return;
    }

    const type = typeof message?.type === 'string' ? message.type : '';
    if (type === 'auth') {
      const token = typeof message.token === 'string' ? message.token.trim() : '';
      if (!token) {
        this.send(client, {
          type: 'AUTH_REQUIRED',
          code: 'AUTH_REQUIRED',
          message: 'Authentication token required',
        });
        this.closeClient(client, 1008, 'Authentication token required');
        return;
      }

      await this.authenticateClient(client, token);
      return;
    }

    if (this.isSubscribeMessage(message)) {
      await this.handleSubscribe(client, message);
      return;
    }

    if (type === 'ping') {
      this.send(client, { type: 'pong', serverTime: new Date().toISOString() });
    }
  }

  private async authenticateClient(client: RealtimeClient, token: string) {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: getJwtSecret(),
      });
      const userId = typeof payload?.sub === 'string' ? payload.sub : payload?.userId;
      const companyId = typeof payload?.companyId === 'string' ? payload.companyId : '';

      if (!userId || !companyId) {
        throw new Error('JWT missing user scope');
      }

      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          companyId: true,
          role: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      client.user = user;
      if (client.authTimer) {
        clearTimeout(client.authTimer);
        client.authTimer = null;
      }

      this.send(client, {
        type: 'session.ready',
        user,
        serverTime: new Date().toISOString(),
      });
    } catch {
      this.send(client, {
        type: 'AUTH_INVALID',
        code: 'AUTH_INVALID',
        message: 'Authentication token is invalid',
      });
      this.closeClient(client, 1008, 'Authentication token is invalid');
    }
  }

  private isSubscribeMessage(message: any) {
    const type = typeof message?.type === 'string' ? message.type : '';
    return type === 'subscribe' || type === 'subscribe.board' || type === 'board.subscribe' || type === 'notifications.subscribe';
  }

  private async handleSubscribe(client: RealtimeClient, message: any) {
    if (!client.user) {
      this.send(client, {
        type: 'AUTH_REQUIRED',
        code: 'AUTH_REQUIRED',
        message: 'Authentication token required',
      });
      return;
    }

    const type = typeof message?.type === 'string' ? message.type : '';
    const scope = this.resolveRequestedScope(message, type);
    const subscriptionId = this.normalizeString(message?.subscriptionId) || this.normalizeString(message?.id) || randomUUID();

    if (!scope) {
      this.send(client, {
        type: 'SUBSCRIPTION_INVALID',
        code: 'SUBSCRIPTION_INVALID',
        subscriptionId,
        message: 'Unsupported subscription scope',
      });
      return;
    }

    try {
      const subscription = await this.resolveSubscription(client.user, scope, message);
      client.subscriptions.set(subscriptionId, { ...subscription, id: subscriptionId });
      this.send(client, {
        type: 'subscription.ack',
        subscriptionId,
        scope,
        params: {
          companyId: subscription.observerCompanyId,
          linkedClientCompanyId: subscription.linkedClientCompanyId,
          targetCompanyId: subscription.targetCompanyId,
        },
      });
    } catch (err) {
      this.send(client, {
        type: 'SUBSCRIPTION_INVALID',
        code: 'SUBSCRIPTION_INVALID',
        subscriptionId,
        scope,
        message: err instanceof Error ? err.message : 'Subscription scope is invalid',
      });
    }
  }

  private resolveRequestedScope(message: any, type: string): 'board' | 'notifications' | null {
    const rawScope = this.normalizeString(message?.scope || message?.channel);
    if (rawScope === 'board' || type === 'subscribe.board' || type === 'board.subscribe') return 'board';
    if (rawScope === 'notifications' || type === 'notifications.subscribe') return 'notifications';
    return null;
  }

  private async resolveSubscription(
    user: RealtimeUser,
    scope: 'board' | 'notifications',
    message: any,
  ): Promise<Omit<RealtimeSubscription, 'id' | 'scope'> & { scope: 'board' | 'notifications' }> {
    if (scope === 'notifications') {
      return {
        scope,
        targetCompanyId: user.companyId,
        linkedClientCompanyId: null,
        observerCompanyId: null,
      };
    }

    const params = message?.params && typeof message.params === 'object' ? message.params : {};
    const linkedClientCompanyId = this.normalizeString(message?.linkedClientCompanyId || params.linkedClientCompanyId);
    const observerCompanyId = this.normalizeString(message?.companyId || params.companyId);

    if (observerCompanyId) {
      if (user.role === UserRole.PLATFORM_ADMIN) {
        const exists = await this.prisma.company.findUnique({
          where: { id: observerCompanyId },
          select: { id: true },
        });
        if (!exists) throw new Error('Observer company scope does not exist');
        return {
          scope,
          targetCompanyId: observerCompanyId,
          linkedClientCompanyId: null,
          observerCompanyId,
        };
      }

      if (observerCompanyId !== user.companyId) {
        throw new Error('Observer company scope is not allowed for this user');
      }
    }

    if (linkedClientCompanyId && linkedClientCompanyId !== user.companyId) {
      const contract = await this.prisma.serviceContract.findUnique({
        where: {
          clientCompanyId_providerCompanyId: {
            clientCompanyId: linkedClientCompanyId,
            providerCompanyId: user.companyId,
          },
        },
        select: {
          status: true,
          role: true,
          startsAt: true,
          endsAt: true,
        },
      });

      if (!contract || !isServiceContractEffective(contract) || contract.role !== ServiceContractRole.PRIMARY) {
        throw new Error('Linked client board scope is not available');
      }
    }

    return {
      scope,
      targetCompanyId: linkedClientCompanyId || observerCompanyId || user.companyId,
      linkedClientCompanyId: linkedClientCompanyId || null,
      observerCompanyId: observerCompanyId || null,
    };
  }

  private async pollRealtimeEvents() {
    if (this.pollInFlight) return;
    this.pollInFlight = true;

    try {
      await Promise.all([this.pollDomainEvents(), this.pollNotifications()]);
    } catch (err) {
      this.logger.warn({ err }, 'realtime_poll_failed');
    } finally {
      this.pollInFlight = false;
    }
  }

  private async pollDomainEvents() {
    const since = new Date(this.domainCursor.getTime() - 1000);
    const events = await this.prisma.domainEvent.findMany({
      where: {
        createdAt: { gte: since },
        entityType: 'Ticket',
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
      select: {
        id: true,
        companyId: true,
        entityType: true,
        entityId: true,
        type: true,
        actorUserId: true,
        createdAt: true,
      },
    });

    for (const event of events) {
      if (event.createdAt > this.domainCursor) {
        this.domainCursor = event.createdAt;
      }
      if (this.seenDomainEventSet.has(event.id)) continue;
      this.rememberDomainEvent(event.id);
      this.broadcastDomainEvent(event);
    }
  }

  private async pollNotifications() {
    const since = new Date(this.notificationCursor.getTime() - 1000);
    const notifications = await this.prisma.notification.findMany({
      where: {
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 500,
      select: {
        id: true,
        companyId: true,
        userId: true,
        type: true,
        entityType: true,
        entityId: true,
        linkedClientCompanyId: true,
        navigationTarget: true,
        createdAt: true,
      },
    });

    for (const notification of notifications) {
      if (notification.createdAt > this.notificationCursor) {
        this.notificationCursor = notification.createdAt;
      }
      if (this.seenNotificationSet.has(notification.id)) continue;
      this.rememberNotification(notification.id);
      this.broadcastNotification(notification);
    }
  }

  private broadcastDomainEvent(event: DomainEventRow) {
    const invalidation = {
      type: 'invalidate',
      targets: ['board', 'tickets', 'ticket', 'timeline', 'notifications'],
      reason: event.type,
      eventId: event.id,
      companyId: event.companyId,
      ticketId: event.entityId,
      entityType: event.entityType,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString(),
    };

    const domainMessage = {
      type: event.type,
      targets: ['board', 'tickets', 'ticket', 'timeline', 'notifications'],
      eventId: event.id,
      companyId: event.companyId,
      ticketId: event.entityId,
      entityType: event.entityType,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt.toISOString(),
    };

    for (const client of this.clients.values()) {
      if (!this.clientReceivesBoardEvent(client, event.companyId)) continue;
      this.send(client, invalidation);
      this.send(client, domainMessage);
    }
  }

  private broadcastNotification(notification: NotificationRow) {
    const notificationMessage = {
      type: 'notifications.invalidate',
      targets: ['notifications'],
      notificationId: notification.id,
      notificationType: notification.type,
      companyId: notification.companyId,
      userId: notification.userId,
      entityType: notification.entityType,
      entityId: notification.entityId,
      linkedClientCompanyId: notification.linkedClientCompanyId,
      navigationTarget:
        notification.navigationTarget ??
        buildLegacyNotificationNavigationTarget({
          entityType: notification.entityType,
          entityId: notification.entityId,
          type: notification.type,
          linkedClientCompanyId: notification.linkedClientCompanyId,
        }),
      createdAt: notification.createdAt.toISOString(),
    };

    const invalidation = {
      type: 'invalidate',
      targets: ['notifications'],
      reason: 'notification.created',
      notificationId: notification.id,
      notificationType: notification.type,
      companyId: notification.companyId,
      userId: notification.userId,
      entityType: notification.entityType,
      entityId: notification.entityId,
      linkedClientCompanyId: notification.linkedClientCompanyId,
      navigationTarget:
        notification.navigationTarget ??
        buildLegacyNotificationNavigationTarget({
          entityType: notification.entityType,
          entityId: notification.entityId,
          type: notification.type,
          linkedClientCompanyId: notification.linkedClientCompanyId,
        }),
      createdAt: notification.createdAt.toISOString(),
    };

    for (const client of this.clients.values()) {
      if (!client.user) continue;
      if (client.user.companyId !== notification.companyId || client.user.id !== notification.userId) continue;
      this.send(client, invalidation);
      this.send(client, notificationMessage);
    }
  }

  private clientReceivesBoardEvent(client: RealtimeClient, companyId: string) {
    if (!client.user) return false;

    const boardSubscriptions = Array.from(client.subscriptions.values()).filter((subscription) => subscription.scope === 'board');
    if (boardSubscriptions.length === 0) {
      return client.user.companyId === companyId;
    }

    return boardSubscriptions.some((subscription) => subscription.targetCompanyId === companyId);
  }

  private send(client: RealtimeClient, payload: Record<string, any>) {
    const data = Buffer.from(JSON.stringify(payload), 'utf8');
    this.writeFrame(client, data, 0x1);
  }

  private writeFrame(client: RealtimeClient, payload: Buffer, opcode: number) {
    if (client.closed || client.socket.destroyed) return;

    let header: Buffer;
    if (payload.length < 126) {
      header = Buffer.alloc(2);
      header[1] = payload.length;
    } else if (payload.length <= 65535) {
      header = Buffer.alloc(4);
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }

    header[0] = 0x80 | opcode;
    client.socket.write(Buffer.concat([header, payload]));
  }

  private closeClient(client: RealtimeClient, code: number, reason: string) {
    if (client.closed) return;
    client.closed = true;

    const reasonBuffer = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBuffer.length);
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2);
    this.writeFrame({ ...client, closed: false }, payload, 0x8);
    client.socket.end();
    this.cleanupClient(client);
  }

  private cleanupClient(client: RealtimeClient) {
    if (client.authTimer) {
      clearTimeout(client.authTimer);
      client.authTimer = null;
    }
    client.closed = true;
    client.subscriptions.clear();
    this.clients.delete(client.id);
  }

  private rememberDomainEvent(id: string) {
    this.seenDomainEventSet.add(id);
    this.seenDomainEventIds.push(id);
    while (this.seenDomainEventIds.length > 5000) {
      const removed = this.seenDomainEventIds.shift();
      if (removed) this.seenDomainEventSet.delete(removed);
    }
  }

  private rememberNotification(id: string) {
    this.seenNotificationSet.add(id);
    this.seenNotificationIds.push(id);
    while (this.seenNotificationIds.length > 5000) {
      const removed = this.seenNotificationIds.shift();
      if (removed) this.seenNotificationSet.delete(removed);
    }
  }

  private normalizeString(value: unknown) {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  private envNumber(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
