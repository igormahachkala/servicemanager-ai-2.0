/**
 * Generic Employee Worker Loop (AI-COMPANY-112G).
 */

export {
  buildEmployeeWorkerLoopContext,
  defaultEmployeeWorkerLoopConstraints,
  resolveEmployeeWorkerLoopFeatures,
  type EmployeeWorkerLoopContext,
  type EmployeeWorkerLoopFeatures,
} from './employeeWorkerLoopContext'

export {
  runEmployeeWorkerLoop,
  runMaxWorkerLoop,
  type RunEmployeeWorkerLoopParams,
} from './employeeWorkerLoopEngine'

export {
  runEmployeeWorkQueueAll,
  runEmployeeWorkQueueNextItem,
  type EmployeeWorkQueueRunAllResult,
  type EmployeeWorkQueueRunResult,
} from './employeeWorkerLoopQueueRunner'
