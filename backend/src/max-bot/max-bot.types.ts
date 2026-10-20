export type MaxBotUpdate = Record<string, unknown>;

export type MaxBotUpdatesResponse = {
  updates?: MaxBotUpdate[];
  marker?: number | null;
};

export type MaxBotSendMessageResponse = {
  message?: unknown;
  [key: string]: unknown;
};
