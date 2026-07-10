/**
 * Generic employee work queue view — thin alias over MAX workspace view model (112C).
 * Uses employeeId; no MAX-specific behavior in callers.
 */

export {
  buildMaxWorkspaceWorkQueueView as buildEmployeeWorkQueueView,
  type MaxWorkspaceWorkQueueView as EmployeeWorkQueueView,
} from '../maxWorkspace/maxWorkspaceWorkQueueViewModel'
