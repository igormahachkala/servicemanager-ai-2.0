export type MaxBotUpdate = Record<string, unknown>;

export type MaxBotInlineKeyboardButton =
  | { type: 'callback'; text: string; payload: string; intent?: 'default' | 'positive' | 'negative' }
  | { type: 'link'; text: string; url: string }
  | { type: 'open_app'; text: string; web_app?: string | null; payload?: string | null; contact_id?: number | null }
  | { type: 'message'; text: string }
  | { type: 'clipboard'; text: string; payload: string }
  | { type: 'request_contact'; text: string }
  | { type: 'request_geo_location'; text: string; quick?: boolean };

export type MaxBotInlineKeyboardAttachment = {
  type: 'inline_keyboard';
  payload: {
    buttons: MaxBotInlineKeyboardButton[][];
  };
};

export type MaxBotMessageBody = {
  text: string | null;
  attachments?: MaxBotInlineKeyboardAttachment[];
  notify?: boolean;
  format?: 'markdown' | 'html';
};

export type MaxBotCommandResponse = MaxBotMessageBody;

export type MaxBotUpdatesResponse = {
  updates?: MaxBotUpdate[];
  marker?: number | null;
};

export type MaxBotSendMessageResponse = {
  message?: unknown;
  [key: string]: unknown;
};
