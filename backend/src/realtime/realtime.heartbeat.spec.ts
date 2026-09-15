import { heartbeatTimedOut, REALTIME_HEARTBEAT_MS } from './realtime.heartbeat';

describe('heartbeatTimedOut', () => {
  it('keeps a client that answered within two intervals', () => {
    expect(heartbeatTimedOut(1_000, 1_000 + REALTIME_HEARTBEAT_MS * 2)).toBe(false);
  });

  it('drops a client silent for more than two intervals', () => {
    expect(heartbeatTimedOut(1_000, 1_000 + REALTIME_HEARTBEAT_MS * 2 + 1)).toBe(true);
  });
});
