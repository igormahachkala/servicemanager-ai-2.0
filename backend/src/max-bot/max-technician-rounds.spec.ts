import {
  parseTechnicianRoundAction,
  renderRoundAfterItem,
  renderRoundBriefMessage,
  renderRoundItemMessage,
  renderRoundListMessage,
  renderRoundPhotoPrompt,
  renderRoundProblemPrompt,
  renderRoundReportMessage,
  renderRoundTicketCreatedMessage,
  renderRoundTicketPrompt,
  toTechnicianRoundListPage,
} from './max-technician-rounds';

const SCHEDULE = '11111111-1111-4111-8111-111111111111';
const RUN = '22222222-2222-4222-8222-222222222222';
const ITEM = '33333333-3333-4333-8333-333333333333';
const TICKET = '44444444-4444-4444-8444-444444444444';

function labelsOf(response: { attachments?: Array<{ payload: { buttons: Array<Array<{ text: string }>> } }> }) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-technician-rounds', () => {
  it('parses start/continue/item and paging payloads', () => {
    expect(parseTechnicianRoundAction(`rst:${SCHEDULE}`)).toEqual({ kind: 'roundStart', scheduleId: SCHEDULE });
    expect(parseTechnicianRoundAction(`rco:${RUN}`)).toEqual({ kind: 'roundContinue', runId: RUN });
    expect(parseTechnicianRoundAction(`rok:${RUN}`)).toEqual({ kind: 'roundOk', runId: RUN });
    expect(parseTechnicianRoundAction('rd:6')).toEqual({ kind: 'roundList', offset: 6 });
    expect(parseTechnicianRoundAction('rcx')).toEqual({ kind: 'roundCancel' });
    expect(parseTechnicianRoundAction('rounds')).toBeNull();
  });

  it('lists assigned rounds with start or continue', () => {
    const page = toTechnicianRoundListPage(
      [
        {
          scheduleId: SCHEDULE,
          runId: null,
          timeLabel: '09:00',
          locationName: 'Кафе',
          name: 'Утро',
          itemCount: 12,
        },
        {
          scheduleId: SCHEDULE,
          runId: RUN,
          timeLabel: '10:00',
          locationName: 'Склад',
          name: 'Холод',
          itemCount: 4,
        },
      ],
      0,
    );
    const res = renderRoundListMessage(page);
    expect(res.text).toContain('09:00 · Кафе');
    expect(res.text).toContain('Утро · 12 пунктов');
    expect(labelsOf(res)).toEqual(['Начать', 'Продолжить', 'Меню']);
  });

  it('renders the item screen and problem/photo/ticket steps', () => {
    const item = renderRoundItemMessage({
      runId: RUN,
      itemId: ITEM,
      locationName: 'Кафе',
      index: 2,
      total: 12,
      equipmentName: 'Холодильник',
      checkText: 'Уплотнитель',
      normText: 'без трещин',
    });
    expect(item.text).toContain('Пункт 2 из 12');
    expect(item.text).toContain('Проверить: Уплотнитель');
    expect(labelsOf(item)).toEqual(['Норма', 'Проблема', 'Критично', 'Отмена']);
    expect(labelsOf(renderRoundProblemPrompt(RUN))).toEqual(['Отмена']);
    expect(labelsOf(renderRoundPhotoPrompt(RUN))).toEqual(['Без фото', 'Отмена']);
    expect(labelsOf(renderRoundTicketPrompt(RUN))).toEqual(['Создать заявку', 'Продолжить обход']);
  });

  it('renders created ticket, brief and detailed report', () => {
    const created = renderRoundTicketCreatedMessage({ runId: RUN, ticketId: TICKET, ticketNumber: 88 });
    expect(created.text).toContain('Создана заявка #88');
    expect(labelsOf(created)).toEqual(['Открыть #88', 'Продолжить обход']);
    const brief = renderRoundBriefMessage({
      runId: RUN,
      okCount: 10,
      issueCount: 1,
      criticalCount: 1,
      createdTicketsCount: 1,
      durationLabel: '42 мин',
    });
    expect(brief.text).toContain('Норма: 10');
    expect(brief.text).toContain('Длительность: 42 мин');
    expect(labelsOf(brief)).toEqual(['Посмотреть итог', 'Меню']);
    const report = renderRoundReportMessage({
      runId: RUN,
      items: [
        { title: 'Свет', status: 'ok', ticketId: null, ticketNumber: null },
        { title: 'Холод', status: 'critical', ticketId: TICKET, ticketNumber: 88 },
      ],
    });
    expect(report.text).toContain('Свет: норма');
    expect(report.text).toContain('Холод: критично · заявка #88');
    expect(labelsOf(report)).toEqual(['Открыть #88', 'Меню']);
  });

  it('maps after-item union onto the matching screen', () => {
    const next = renderRoundAfterItem({
      kind: 'item',
      item: {
        runId: RUN,
        itemId: ITEM,
        locationName: 'Кафе',
        index: 1,
        total: 1,
        equipmentName: '—',
        checkText: 'Пол',
        normText: 'сухой',
      },
    });
    expect(next.text).toContain('Пункт 1 из 1');
  });
});
