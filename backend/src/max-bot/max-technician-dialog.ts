import { extractMaxUserId, MaxIdentity } from './max-identity.service';
import { DownloadedMaxFile, MaxFileClient, MaxIncomingMedia } from './max-file.client';
import {
  renderAwaitingPhotoMessage,
  renderCompleteDoneMessage,
  renderCompletePhotoAskMessage,
  renderCompleteReportPrompt,
  renderPhotoPromptMessage,
  renderPhotoSavedMessage,
} from './max-technician-ticket-dialogs';
import {
  renderCommentPromptMessage,
  renderCommentSavedMessage,
  renderTechnicianTicketCardMessage,
  renderTicketUnavailableMessage,
} from './max-technician-tickets';
import { MaxTechnicianWorkplaceService } from './max-technician-workplace.service';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';
import { renderPersistentMenuMessage } from './max-menu.builder';

type ResolvedTechnician = Extract<MaxIdentity, { resolved: true }>;

type TicketWait =
  | { kind: 'comment'; ticketId: string; ticketNumber: number }
  | { kind: 'photo'; ticketId: string; ticketNumber: number }
  | { kind: 'complete-text'; ticketId: string; ticketNumber: number }
  | { kind: 'complete-photo'; ticketId: string; ticketNumber: number; report: string; awaitingFile: boolean };

const KEEP_WAIT = new Set(['comment', 'photo', 'complete', 'completePhoto', 'completeAsk', 'completeSkip']);
const ACTION_FAILED = 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';

export class MaxTechnicianDialog {
  private readonly wait = new Map<string, TicketWait>();

  constructor(
    private readonly workplace?: MaxTechnicianWorkplaceService,
    private readonly files: MaxFileClient = new MaxFileClient(),
  ) {}

  keepsWait(kind: string) {
    return KEEP_WAIT.has(kind);
  }

  clear(update: MaxBotUpdate) {
    const maxUserId = extractMaxUserId(update);
    if (maxUserId) this.wait.delete(maxUserId);
  }

  async beginComment(technician: ResolvedTechnician, ticketId: string) {
    const card = await this.requireCard(technician, ticketId);
    if (!card.ok) return card.response;
    this.wait.set(technician.maxUserId, { kind: 'comment', ticketId, ticketNumber: card.value.ticketNumber });
    return renderCommentPromptMessage(ticketId, card.value.ticketNumber);
  }

  async beginPhoto(technician: ResolvedTechnician, ticketId: string) {
    const card = await this.requireCard(technician, ticketId);
    if (!card.ok) return card.response;
    this.wait.set(technician.maxUserId, { kind: 'photo', ticketId, ticketNumber: card.value.ticketNumber });
    return renderPhotoPromptMessage(ticketId, card.value.ticketNumber, `tk:${ticketId}`);
  }

  async beginComplete(technician: ResolvedTechnician, ticketId: string) {
    const card = await this.requireCard(technician, ticketId);
    if (!card.ok) return card.response;
    if (!card.value.canComplete) return renderTechnicianTicketCardMessage(card.value);
    this.wait.set(technician.maxUserId, { kind: 'complete-text', ticketId, ticketNumber: card.value.ticketNumber });
    return renderCompleteReportPrompt(ticketId, card.value.ticketNumber);
  }

  async requestCompletePhoto(technician: ResolvedTechnician, ticketId: string) {
    const pending = this.wait.get(technician.maxUserId);
    if (!pending || pending.kind !== 'complete-photo' || pending.ticketId !== ticketId) {
      return this.beginComplete(technician, ticketId);
    }
    pending.awaitingFile = true;
    this.wait.set(technician.maxUserId, pending);
    return renderPhotoPromptMessage(ticketId, pending.ticketNumber, `tky:${ticketId}`);
  }

  async backToCompleteAsk(technician: ResolvedTechnician, ticketId: string) {
    const pending = this.wait.get(technician.maxUserId);
    if (!pending || pending.kind !== 'complete-photo' || pending.ticketId !== ticketId) {
      return this.beginComplete(technician, ticketId);
    }
    pending.awaitingFile = false;
    this.wait.set(technician.maxUserId, pending);
    return renderCompletePhotoAskMessage(ticketId, pending.ticketNumber);
  }

  async skipCompletePhoto(technician: ResolvedTechnician, ticketId: string) {
    const pending = this.wait.get(technician.maxUserId);
    if (!pending || pending.kind !== 'complete-photo' || pending.ticketId !== ticketId) {
      return this.beginComplete(technician, ticketId);
    }
    return this.finishComplete(technician, pending, undefined);
  }

  async submitText(technician: ResolvedTechnician, text: string): Promise<MaxBotCommandResponse | null> {
    const pending = this.wait.get(technician.maxUserId);
    if (!pending) return null;
    if (pending.kind === 'photo' || (pending.kind === 'complete-photo' && pending.awaitingFile)) {
      return renderAwaitingPhotoMessage(this.cancelPayload(pending));
    }
    if (pending.kind === 'complete-photo') {
      return renderCompletePhotoAskMessage(pending.ticketId, pending.ticketNumber);
    }
    if (pending.kind === 'comment') {
      if (!text) return renderCommentPromptMessage(pending.ticketId, pending.ticketNumber);
      return this.saveComment(technician, pending, text);
    }
    if (!text) return renderCompleteReportPrompt(pending.ticketId, pending.ticketNumber);
    this.wait.set(technician.maxUserId, {
      kind: 'complete-photo',
      ticketId: pending.ticketId,
      ticketNumber: pending.ticketNumber,
      report: text,
      awaitingFile: false,
    });
    return renderCompletePhotoAskMessage(pending.ticketId, pending.ticketNumber);
  }

  async submitMedia(
    technician: ResolvedTechnician,
    media: MaxIncomingMedia[],
  ): Promise<MaxBotCommandResponse | null> {
    const pending = this.wait.get(technician.maxUserId);
    if (!pending) return null;
    if (media.length === 0) return this.submitText(technician, '');
    if (pending.kind === 'comment') return renderCommentPromptMessage(pending.ticketId, pending.ticketNumber);
    if (pending.kind === 'complete-text') return renderCompleteReportPrompt(pending.ticketId, pending.ticketNumber);
    if (pending.kind === 'complete-photo' && !pending.awaitingFile) {
      return renderCompletePhotoAskMessage(pending.ticketId, pending.ticketNumber);
    }
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED);
    const downloaded: DownloadedMaxFile[] = [];
    for (const file of media) {
      try {
        downloaded.push(await this.files.download(file));
      } catch (err) {
        const message = err instanceof Error ? err.message : ACTION_FAILED;
        const prompt = renderPhotoPromptMessage(pending.ticketId, pending.ticketNumber, this.cancelPayload(pending));
        return { ...prompt, text: `${message}\n\n${prompt.text}` };
      }
    }
    if (pending.kind === 'photo') return this.savePhotos(technician, pending, downloaded);
    return this.finishCompleteWithPhotos(technician, pending, downloaded);
  }

  private async saveComment(
    technician: ResolvedTechnician,
    pending: Extract<TicketWait, { kind: 'comment' }>,
    text: string,
  ) {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED);
    const result = await this.workplace.addMyTicketComment(technician, pending.ticketId, text);
    if (!result.ok) {
      if (result.message.toLowerCase().includes('comment is required')) {
        return renderCommentPromptMessage(pending.ticketId, pending.ticketNumber);
      }
      this.wait.delete(technician.maxUserId);
      return this.fail(result.message);
    }
    this.wait.delete(technician.maxUserId);
    return renderCommentSavedMessage(result.value.ticketId, result.value.ticketNumber);
  }

  private async savePhotos(
    technician: ResolvedTechnician,
    pending: Extract<TicketWait, { kind: 'photo' }>,
    files: DownloadedMaxFile[],
  ) {
    let last: { ticketId: string; ticketNumber: number; count: number } | null = null;
    for (const file of files) {
      const result = await this.workplace!.addMyTicketPhoto(technician, pending.ticketId, file);
      if (!result.ok) {
        this.wait.delete(technician.maxUserId);
        return this.fail(result.message);
      }
      last = result.value;
    }
    this.wait.set(technician.maxUserId, pending);
    return renderPhotoSavedMessage(last!.ticketId, last!.ticketNumber, last!.count);
  }

  private async finishCompleteWithPhotos(
    technician: ResolvedTechnician,
    pending: Extract<TicketWait, { kind: 'complete-photo' }>,
    files: DownloadedMaxFile[],
  ) {
    for (const extra of files.slice(0, -1)) {
      const attached = await this.workplace!.addMyTicketPhoto(technician, pending.ticketId, extra);
      if (!attached.ok) {
        pending.awaitingFile = false;
        this.wait.set(technician.maxUserId, pending);
        const ask = renderCompletePhotoAskMessage(pending.ticketId, pending.ticketNumber);
        return { ...ask, text: `${attached.message}\n\n${ask.text}` };
      }
    }
    return this.finishComplete(technician, pending, files[files.length - 1]);
  }

  private async finishComplete(
    technician: ResolvedTechnician,
    pending: Extract<TicketWait, { kind: 'complete-photo' }>,
    file: { buffer: Buffer; size: number; mimetype: string; originalname: string } | undefined,
  ) {
    if (!this.workplace) return renderPersistentMenuMessage(ACTION_FAILED);
    const result = await this.workplace.completeMyTicket(technician, pending.ticketId, pending.report, file);
    if (!result.ok) {
      pending.awaitingFile = false;
      this.wait.set(technician.maxUserId, pending);
      const ask = renderCompletePhotoAskMessage(pending.ticketId, pending.ticketNumber);
      return { ...ask, text: `${result.message}\n\n${ask.text}` };
    }
    this.wait.delete(technician.maxUserId);
    return renderCompleteDoneMessage(result.value.id, result.value.ticketNumber, result.value.statusLabel);
  }

  private async requireCard(technician: ResolvedTechnician, ticketId: string) {
    if (!this.workplace) return { ok: false as const, response: renderPersistentMenuMessage(ACTION_FAILED) };
    const result = await this.workplace.ticketCard(technician, ticketId);
    if (!result.ok) {
      this.wait.delete(technician.maxUserId);
      return { ok: false as const, response: this.fail(result.message) };
    }
    return { ok: true as const, value: result.value };
  }

  private fail(message: string) {
    return message === 'Заявка недоступна' ? renderTicketUnavailableMessage() : renderPersistentMenuMessage(message);
  }

  private cancelPayload(pending: TicketWait) {
    if (pending.kind === 'complete-photo') return `tky:${pending.ticketId}`;
    return `tk:${pending.ticketId}`;
  }
}

export type { ResolvedTechnician };
