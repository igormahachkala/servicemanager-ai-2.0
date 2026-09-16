import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import {
  resolveNotificationNavigationTargetPath,
  resolveNotificationSourcePath,
} from './notificationNavigation'

const swSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../public/sw.js'), 'utf8')

function loadServiceWorker() {
  const self = {
    location: {
      origin: 'https://servicemanagerai.ru',
      href: 'https://servicemanagerai.ru/sw.js',
    },
    registration: {
      showNotification() {},
      navigationPreload: undefined,
      pushManager: {
        subscribe: async () => ({ endpoint: 'https://push.example/sub', toJSON: () => ({ keys: {} }) }),
      },
    },
    clients: {
      claim() {},
      matchAll: async () => [],
      openWindow: async (target: string) => ({ target }),
    },
    skipWaiting() {},
    addEventListener() {},
    removeEventListener() {},
  }
  const context = vm.createContext({
    console,
    URL,
    setTimeout,
    clearTimeout,
    fetch: async () => undefined,
    self,
  })
  vm.runInContext(swSource, context, { filename: 'sw.js' })
  return context as typeof context & { notificationTarget: (payload: object, client: { url: string } | null) => string }
}

describe('notification navigation', () => {
  it('builds ticket paths per surface', () => {
    const target = {
      kind: 'ticket' as const,
      ticketId: 'ticket-42',
      section: 'comments' as const,
      linkedClientCompanyId: 'client-1',
      sourceEventId: 'event-1',
    }
    expect(resolveNotificationNavigationTargetPath(target, 'desktop')).toBe(
      '/tickets/ticket-42?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1',
    )
    expect(resolveNotificationNavigationTargetPath(target, 'mobile')).toBe(
      '/m/tickets/ticket-42?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1',
    )
    expect(resolveNotificationNavigationTargetPath(target, 'max')).toBe(
      '/max/tickets/ticket-42?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1',
    )
  })

  it('maps legacy notification types to sections', () => {
    expect(
      resolveNotificationSourcePath(
        { type: 'ticket.attachment_uploaded', entityType: 'Ticket', entityId: 'ticket-attachment' },
        'mobile',
      ),
    ).toBe('/m/tickets/ticket-attachment?section=attachments')
    expect(
      resolveNotificationSourcePath(
        { type: 'ticket.awaiting_acceptance', entityType: 'Ticket', entityId: 'ticket-acceptance' },
        'desktop',
      ),
    ).toBe('/tickets/ticket-acceptance?section=acceptance')
    expect(resolveNotificationSourcePath({ entityType: 'Company', entityId: 'company-1' }, 'desktop')).toBe(null)
  })

  it('resolves notificationTarget in the service worker', () => {
    const sw = loadServiceWorker()
    const client = (pathname: string) => ({ url: `https://servicemanagerai.ru${pathname}` })

    expect(
      sw.notificationTarget(
        { navigationTarget: { kind: 'ticket', ticketId: 'ticket-closed', section: 'actions' } },
        null,
      ),
    ).toBe('/m/tickets/ticket-closed?section=actions')

    expect(
      sw.notificationTarget(
        {
          navigationTarget: {
            kind: 'ticket',
            ticketId: 'ticket-comments',
            section: 'comments',
            linkedClientCompanyId: 'client-1',
            sourceEventId: 'event-1',
          },
        },
        null,
      ),
    ).toBe('/m/tickets/ticket-comments?section=comments&tab=chat&linkedClientCompanyId=client-1&sourceEventId=event-1')

    expect(
      sw.notificationTarget(
        { navigationTarget: { kind: 'ticket', ticketId: 'ticket-mobile', section: 'history' } },
        client('/m'),
      ),
    ).toBe('/m/tickets/ticket-mobile?section=history')

    expect(
      sw.notificationTarget(
        { navigationTarget: { kind: 'ticket', ticketId: 'ticket-max', section: 'comments' } },
        client('/max'),
      ),
    ).toBe('/max/tickets/ticket-max?section=comments&tab=chat')

    expect(
      sw.notificationTarget(
        { navigationTarget: { kind: 'ticket', ticketId: 'ticket-desktop', section: 'attachments' } },
        client('/board'),
      ),
    ).toBe('/tickets/ticket-desktop?section=attachments')

    expect(
      sw.notificationTarget(
        {
          ticketId: 'legacy-ticket',
          notificationType: 'ticket.comment_added',
          targetRoute: '/tickets/legacy-ticket?section=comments&tab=chat',
        },
        null,
      ),
    ).toBe('/m/tickets/legacy-ticket?section=comments&tab=chat')

    expect(sw.notificationTarget({}, null)).toBe('/m')
  })
})
