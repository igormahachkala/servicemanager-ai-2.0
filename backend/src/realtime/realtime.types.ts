import type { UserRole } from '@prisma/client';
import type { Socket } from 'node:net';

export type RealtimeUser = {
  id: string;
  email: string;
  companyId: string;
  role: UserRole;
};

export type RealtimeSubscription = {
  id: string;
  scope: 'board' | 'notifications';
  targetCompanyId: string;
  linkedClientCompanyId: string | null;
  observerCompanyId: string | null;
};

export type RealtimeClient = {
  id: string;
  socket: Socket;
  receiveBuffer: Buffer;
  subscriptions: Map<string, RealtimeSubscription>;
  user: RealtimeUser | null;
  tokenExpiresAt: number | null;
  authTimer: NodeJS.Timeout | null;
  lastPongAt: number;
  closed: boolean;
};
