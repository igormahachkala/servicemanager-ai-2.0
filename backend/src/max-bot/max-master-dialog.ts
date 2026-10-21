import { extractMaxUserId, MaxIdentity } from './max-identity.service';
import { MaxBotCommandResponse, MaxBotUpdate } from './max-bot.types';
import { renderMasterCommentPrompt, renderMasterCommentSaved } from './max-master-tickets';
import { MaxMasterWorkplaceService } from './max-master-workplace.service';
import { renderPersistentMenuMessage } from './max-menu.builder';

type ResolvedMaster = Extract<MaxIdentity, { resolved: true }>;

type MasterWait = { kind: 'comment'; ticketId: string; ticketNumber: number; mention: boolean };

const FAILED = 'Не удалось выполнить действие.\nПопробуйте ещё раз через минуту.';

export class MaxMasterDialog {
  private readonly wait = new Map<string, MasterWait>();

  constructor(private readonly workplace?: MaxMasterWorkplaceService) {}

  clear(update: MaxBotUpdate) {
    const maxUserId = extractMaxUserId(update);
    if (maxUserId) this.wait.delete(maxUserId);
  }

  beginComment(identity: ResolvedMaster, ticketId: string, ticketNumber: number, mention: boolean) {
    this.wait.set(identity.maxUserId, { kind: 'comment', ticketId, ticketNumber, mention });
    return renderMasterCommentPrompt(ticketId, ticketNumber, mention);
  }

  async submitText(identity: ResolvedMaster, text: string): Promise<MaxBotCommandResponse | null> {
    const state = this.wait.get(identity.maxUserId);
    if (!state || state.kind !== 'comment') return null;
    const comment = text.trim();
    if (!comment) return renderMasterCommentPrompt(state.ticketId, state.ticketNumber, state.mention);
    if (!this.workplace) return renderPersistentMenuMessage(FAILED);
    const result = await this.workplace.comment(identity, state.ticketId, comment);
    this.wait.delete(identity.maxUserId);
    if (!result.ok) return renderPersistentMenuMessage(result.message);
    return renderMasterCommentSaved(state.ticketId, result.value.ticketNumber);
  }
}
