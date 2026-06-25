export const TASK_TYPES = [
  'general',
  'planning',
  'coding',
  'review',
  'analysis',
  'conversation',
  'embedding',
  'vision',
] as const

export type TaskType = (typeof TASK_TYPES)[number]

export type RouteCondition = {
  key: string
  operator: 'eq' | 'neq' | 'gt' | 'lt'
  value: string | number | boolean
}

export type ModelRoute = {
  id: string
  name: string
  taskType: TaskType
  preferredModelId: string
  fallbackModelIds: string[]
  conditions: RouteCondition[]
  priority: number
}

export type TaskContext = {
  taskType: TaskType | string
  hasSensitiveData?: boolean
  estimatedTokens?: number
  preferLocal?: boolean
  requiresVision?: boolean
  requiresTools?: boolean
  requiresCode?: boolean
  requiresExternalTools?: boolean
}

export type ModelSelection = {
  selectedModelId: string
  selectedProviderId: string
  reason: string
  fallbackChain: Array<{ modelId: string; providerId: string }>
  requiresApproval: boolean
}

export function matchRoute(route: ModelRoute, context: TaskContext): boolean {
  if (route.taskType !== context.taskType) return false
  return route.conditions.every((condition) => {
    const ctxValue = readContextValue(context, condition.key)
    if (ctxValue === undefined) return false
    switch (condition.operator) {
      case 'eq':
        return ctxValue === condition.value
      case 'neq':
        return ctxValue !== condition.value
      case 'gt':
        return Number(ctxValue) > Number(condition.value)
      case 'lt':
        return Number(ctxValue) < Number(condition.value)
      default:
        return false
    }
  })
}

function readContextValue(context: TaskContext, key: string): unknown {
  if (key in context) return context[key as keyof TaskContext]
  return undefined
}
