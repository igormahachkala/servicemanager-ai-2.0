import { UserRole } from '@prisma/client';

import { MaxChatService } from './max-chat.service';

function buttonsOf(response: Awaited<ReturnType<MaxChatService['handleMenu']>>) {
  return response.attachments?.[0]?.payload.buttons.flat().map((button) => button.text) || [];
}

describe('MaxChatService menu', () => {
  it('unbound viewer gets the linking menu, not technician actions', async () => {
    const identity = { resolve: jest.fn().mockResolvedValue({ resolved: false, reason: 'not_bound' }) };
    const chat = new MaxChatService(identity as any);
    const res = await chat.handleMenu({ message: { text: '/start', sender: { user_id: 1 } } });
    expect(buttonsOf(res)).toEqual(['Открыть ServiceManager', 'Помощь']);
    expect(res.text).not.toContain('Мои заявки');
  });

  it('bound technician gets the six chat actions', async () => {
    const identity = {
      resolve: jest.fn().mockResolvedValue({
        resolved: true,
        userId: 'u1',
        companyId: 'c1',
        role: UserRole.TECHNICIAN,
        maxUserId: '1',
      }),
    };
    const chat = new MaxChatService(identity as any);
    const res = await chat.handleMenu({ message: { text: '/start', sender: { user_id: 1 } } });
    expect(buttonsOf(res)).toEqual([
      'Сегодня',
      'Мои заявки',
      'Доступные',
      'Обходы',
      'Моя смена',
      'Поиск заявки',
    ]);
  });
});
