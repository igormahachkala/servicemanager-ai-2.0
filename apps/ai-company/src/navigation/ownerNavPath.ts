/**
 * Owner nav — path → group resolution for breadcrumbs (105B).
 */

import type { Messages } from '../i18n/en'
import {
  OWNER_NAV_ITEMS,
  type OwnerNavGroupId,
  type OwnerNavItemId,
} from './ownerNavConfig'

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function resolveOwnerNavItemForPath(pathname: string): (typeof OWNER_NAV_ITEMS)[number] | null {
  const path = normalizePath(pathname)
  let best: (typeof OWNER_NAV_ITEMS)[number] | null = null

  for (const item of OWNER_NAV_ITEMS) {
    if (item.end ? path === item.to : path === item.to || path.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) {
        best = item
      }
    }
  }

  return best
}

export function resolveOwnerNavGroupForPath(pathname: string): OwnerNavGroupId | null {
  return resolveOwnerNavItemForPath(pathname)?.group ?? null
}

export function ownerNavItemLabel(itemId: OwnerNavItemId, t: Messages): string {
  return t.ownerNav.items[itemId].label
}

export function ownerNavGroupLabel(groupId: OwnerNavGroupId, t: Messages): string {
  return t.ownerNav.groups[groupId].title
}

export function ownerNavItemHint(itemId: OwnerNavItemId, t: Messages): string {
  const item = t.ownerNav.items[itemId]
  return `${item.what} · ${item.why} · ${item.action}`
}
