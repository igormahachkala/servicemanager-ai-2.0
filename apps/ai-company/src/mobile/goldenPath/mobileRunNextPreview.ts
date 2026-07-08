import type { WorkItem } from '../../domain/employeeWorkQueue'
import type { MobileRunNextPreview } from '../hooks/useMobileEmployeeMax'

export function mobileRunNextPreviewFromWorkItem(
  item: WorkItem,
  employeeName: string,
  modelLabel: string | null = null,
): MobileRunNextPreview {
  return {
    workItemId: item.id,
    title: item.title,
    taskText: item.taskText?.trim() || item.summary?.trim() || item.title,
    priority: item.priority,
    employeeName,
    modelLabel,
  }
}
