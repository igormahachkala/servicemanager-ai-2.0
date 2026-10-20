export function mapReason(reason: string): string {
  const r = (reason || '').toLowerCase()
  const chunks: string[] = []
  if (r.includes('least_loaded')) chunks.push('минимальная загрузка')
  if (r.includes('location_match')) chunks.push('совпадение локации')
  if (r.includes('category_match')) chunks.push('подходит по категории')
  if (r === 'manual_select') return 'назначено вручную'
  if (chunks.length > 0) return chunks.join(' + ')
  return 'решение системы'
}
