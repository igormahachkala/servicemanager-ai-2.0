import {
  getMasterLinkedClient,
  renderMasterClientPickerMessage,
  renderMasterNoLinkedClientsMessage,
  resetMasterLinkedClientsForTests,
  setMasterLinkedClient,
  toMasterClientPickerPage,
} from './max-master-client-scope';

function labelsOf(response: {
  attachments?: Array<{ payload: { buttons: Array<Array<{ text: string }>> } }>;
}) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('max-master-client-scope', () => {
  beforeEach(() => resetMasterLinkedClientsForTests());

  it('stores and clears selected client by maxUserId', () => {
    expect(getMasterLinkedClient('42')).toBeNull();
    setMasterLinkedClient('42', 'client-1');
    expect(getMasterLinkedClient('42')).toBe('client-1');
    setMasterLinkedClient('42', 'client-2');
    expect(getMasterLinkedClient('42')).toBe('client-2');
  });

  it('pages clients three per screen, one button per row', () => {
    const clients = [
      { id: '1', name: 'Альфа', role: 'PRIMARY' },
      { id: '2', name: 'Бета', role: 'PRIMARY' },
      { id: '3', name: 'Гамма', role: 'SECONDARY' },
      { id: '4', name: 'Дельта', role: 'PRIMARY' },
    ];
    const page = toMasterClientPickerPage(clients, 0, '2');
    expect(page.items.map((item) => item.name)).toEqual(['Альфа', 'Бета', 'Гамма']);
    expect(page.currentName).toBe('Бета');
    expect(page.nextOffset).toBe(3);
    const res = renderMasterClientPickerMessage(page);
    expect(res.text).toContain('Сейчас: Бета');
    expect(labelsOf(res)).toEqual(['Альфа', 'Бета', 'Гамма', 'Следующие']);
    const rows = res.attachments?.[0]?.payload.buttons || [];
    expect(rows[0]).toHaveLength(1);
    expect(rows[1]).toHaveLength(1);
    expect(rows[2]).toHaveLength(1);
  });

  it('renders empty-clients message without list buttons', () => {
    const res = renderMasterNoLinkedClientsMessage();
    expect(res.text).toContain('Связанных клиентов нет');
    expect(res.attachments).toBeUndefined();
  });
});
