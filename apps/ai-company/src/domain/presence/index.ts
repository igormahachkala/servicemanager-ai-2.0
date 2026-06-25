export {
  PRESENCE_STATUSES,
  PRESENCE_STORAGE_KEY,
  getPresenceByEmployeeId,
  loadPresenceRecords,
  parseEmployeePresence,
  savePresenceRecords,
  upsertPresence,
  type EmployeePresence,
  type PresenceStatus,
  type UpsertPresenceInput,
} from './presence'
export {
  WORKDAY_EVENT_TYPES,
  WORKDAY_STORAGE_KEY,
  appendWorkdayEvent,
  getTodayWorkdayEvents,
  getWorkdayEventsForEmployee,
  loadWorkdayEvents,
  type WorkdayEvent,
  type WorkdayEventType,
} from './workdayEvent'
export {
  computePresenceStats,
  isPresenceWaiting,
  isPresenceWorking,
  type PresenceStats,
} from './presenceStats'
export {
  applyRoutePresenceContext,
  ensureSeedWorkdayEvents,
  initializePresenceEngine,
  syncPresenceFromPlatform,
} from './presenceEngine'
