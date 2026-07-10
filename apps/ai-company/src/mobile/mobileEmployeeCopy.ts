/**
 * Resolve mobile employee UI copy by employeeId (112C).
 */

import { MAX_WORKER_EMPLOYEE_ID } from '../domain/maxWorkerLoop'
import { BUILDER_EMPLOYEE_ID } from '../domain/mobileEmployee'
import type { mobileRu } from '../i18n/mobile/ru'

type MobileI18n = typeof mobileRu

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  )
}

export function resolveMobileEmployeeProfileCopy(
  employeeId: string,
  t: { maxControl: MobileI18n['maxControl']; employeeProfiles: MobileI18n['employeeProfiles'] },
) {
  if (employeeId === MAX_WORKER_EMPLOYEE_ID) {
    return t.maxControl
  }
  if (employeeId === BUILDER_EMPLOYEE_ID) {
    return t.employeeProfiles.builder
  }
  const generic = t.employeeProfiles.generic
  const name = employeeId
  return {
    ...generic,
    pageTitle: interpolate(generic.pageTitle, { employeeName: name }),
    readyBanner: interpolate(generic.readyBanner, { employeeName: name }),
    activeBanner: interpolate(generic.activeBanner, { employeeName: name }),
    runtimeGuideHint: generic.runtimeGuideHint,
    sections: generic.sections,
    hero: {
      ...generic.hero,
      openChat: interpolate(generic.hero.openChat, { employeeName: name }),
    },
    workday: {
      ...generic.workday,
      title: interpolate(generic.workday.title, { employeeName: name }),
    },
    workQueue: {
      ...generic.workQueue,
      title: interpolate(generic.workQueue.title, { employeeName: name }),
    },
    lastResult: generic.lastResult,
    runNextConfirm: generic.runNextConfirm,
  }
}

export function resolveMobileEmployeeChatCopy(
  employeeId: string,
  t: { maxChat: MobileI18n['maxChat']; employeeChat: MobileI18n['employeeChat'] },
) {
  if (employeeId === MAX_WORKER_EMPLOYEE_ID) {
    return t.maxChat
  }
  if (employeeId === BUILDER_EMPLOYEE_ID) {
    return t.employeeChat.builder
  }
  const generic = t.employeeChat.generic
  const name = employeeId
  return {
    ...generic,
    pageTitle: interpolate(generic.pageTitle, { employeeName: name }),
    intro: interpolate(generic.intro, { employeeName: name }),
    welcome: interpolate(generic.welcome, { employeeName: name }),
    taskProposalIntro: interpolate(generic.taskProposalIntro, { employeeName: name }),
    status: {
      ...generic.status,
      ready: interpolate(generic.status.ready, { employeeName: name }),
    },
  }
}
