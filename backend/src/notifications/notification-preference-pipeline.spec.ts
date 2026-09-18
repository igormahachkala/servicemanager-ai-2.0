import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * SMA-NOTIFICATION-PREFERENCES-V2-105B.
 *
 * Инварианты конвейера, которые нельзя проверить вызовом: порядок слоёв и
 * единственность точки записи. Они ломаются не логикой, а новым кодом рядом —
 * поэтому проверяются по исходнику.
 *
 *   событие → доступ → настройка → Notification → канал
 */

const SERVICE = readFileSync(
  join(__dirname, 'notifications.service.ts'),
  'utf8',
);

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('105B конвейер уведомлений', () => {
  it('запись Notification остаётся единственной точкой', () => {
    const singleWrites = SERVICE.match(/prisma\.notification\.create\(/g) ?? [];
    const batchWrites =
      SERVICE.match(/prisma\.notification\.createMany\(/g) ?? [];

    expect(singleWrites).toHaveLength(1);
    expect(batchWrites).toHaveLength(1);
  });

  it('обе точки записи проходят через ворота настроек', () => {
    for (const funnel of ['createNotification(', 'createNotifications(']) {
      const at = SERVICE.indexOf(`private async ${funnel}`);
      expect(at).toBeGreaterThan(-1);
      const body = SERVICE.slice(at, at + 1400);
      expect(body).toContain('preferenceGate');
      expect(body).toContain('NotificationChannel.IN_APP');
    }
  });

  it('ворота стоят до записи, а не после неё', () => {
    const at = SERVICE.indexOf('private async createNotification(');
    const body = SERVICE.slice(at, at + 1400);
    expect(body.indexOf('preferenceGate')).toBeLessThan(
      body.indexOf('prisma.notification.create('),
    );
  });

  it('персональные V1-настройки не перехватывают PUSH', () => {
    const at = SERVICE.indexOf('private async pushTicketEvent(');
    expect(at).toBeGreaterThan(-1);
    const body = SERVICE.slice(at, at + 2000);
    expect(body).not.toContain('preferenceGate');
    expect(body).not.toContain('NotificationChannel.PUSH');
    expect(body).toContain('this.push.sendToUser(');
  });

  it('второго резолвера доступа не появилось', () => {
    /**
     * Проверяется код, а не комментарии: упоминание чужого метода в пояснении
     * допустимо, вызов — нет.
     */
    const gate = stripComments(
      readFileSync(join(__dirname, 'notification-preference-gate.ts'), 'utf8'),
    );
    for (const forbidden of [
      'canReadTicketForNotification',
      'filterRecipientsByTicketAccess',
      'resolveAccessibleTicketUsers',
      'ticket.findFirst',
      'ticket.findMany',
      'serviceContract.findMany',
    ]) {
      expect(gate).not.toContain(forbidden);
    }
  });

  it('ворота не умеют добавлять получателей: единственный выход — подмножество входа', () => {
    const gate = readFileSync(
      join(__dirname, 'notification-preference-gate.ts'),
      'utf8',
    );
    const at = gate.indexOf('async filterRows');
    const body = gate.slice(at, gate.indexOf('\n  }', at));
    // Внутрь результата попадают только строки исходного массива.
    expect(body).toContain('kept.push(row)');
    expect(body).not.toMatch(/kept\.push\((?!row\))/);
    expect(body).not.toContain('user.findMany({ where: { companyId');
  });

  it('MAX-канал ворота не трогают', () => {
    const gate = readFileSync(
      join(__dirname, 'notification-preference-gate.ts'),
      'utf8',
    );
    expect(gate).not.toContain('NotificationChannel.MAX');
    expect(gate).not.toContain('maxBot');
  });
});
