/** Last list callback for «Назад» on a ticket card. Process memory only. */
const backByMaxUserId = new Map<string, string>();

export function setTicketListBack(maxUserId: string, payload: string): void {
  const value = payload.trim();
  if (!value) return;
  backByMaxUserId.set(maxUserId, value);
}

export function getTicketListBack(maxUserId: string): string | null {
  return backByMaxUserId.get(maxUserId) ?? null;
}

export function clearTicketListBack(maxUserId: string): void {
  backByMaxUserId.delete(maxUserId);
}

/** Test helper. */
export function resetTicketListBackForTests(): void {
  backByMaxUserId.clear();
}
