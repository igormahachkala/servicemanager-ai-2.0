import type { ReactElement, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EquipmentPhotoGallery } from './EquipmentPhotoGallery'
import { ApiRequestError } from '../../lib/api'
import type { EquipmentPhotoGalleryData } from '../../lib/equipmentPhotos'

type Variables = { photoId: string; version: string }
type MutationOptions = {
  onSuccess: (data: EquipmentPhotoGalleryData, variables: Variables) => Promise<void>
  onError: (error: Error) => Promise<void>
  onSettled: () => void
}
const harness = vi.hoisted(() => ({
  states: [] as unknown[], stateIndex: 0,
  refs: [] as { current: unknown }[], refIndex: 0,
  query: {} as { data?: EquipmentPhotoGalleryData; isPending?: boolean; isError?: boolean; isFetching?: boolean },
  options: null as MutationOptions | null,
  mutate: vi.fn(), setQueryData: vi.fn(), invalidateQueries: vi.fn().mockResolvedValue(undefined),
}))
// These are handler/state unit tests, not a DOM/browser simulation. SSR coverage
// lives in EquipmentPhotoGallery.test.ts with real React/React Query hooks.
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (next: unknown) => {
      harness.states[index] = typeof next === 'function' ? next(harness.states[index]) : next
    }]
  },
  useRef: (initial: unknown) => {
    const index = harness.refIndex++
    return harness.refs[index] ?? (harness.refs[index] = { current: initial })
  },
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => harness.query,
  useQueryClient: () => ({ setQueryData: harness.setQueryData, invalidateQueries: harness.invalidateQueries }),
  useMutation: (options: MutationOptions) => {
    harness.options = options
    return { mutate: harness.mutate, isPending: false }
  },
}))
const DATA: EquipmentPhotoGalleryData = {
  mainPhotoId: 'p1', version: 'server-version', photos: ['p1', 'p2'].map((id) => ({
    id, url: '/uploads/equipment/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', mimeType: 'image/jpeg', createdAt: '',
  })),
}
type NodeProps = { children?: ReactNode; onClick?: () => void; 'aria-label'?: string; disabled?: boolean; url?: string }
const props = { equipmentId: 'eq-1', scopeCompanyId: 'client-1', equipmentName: 'Котёл', canManage: true }
function render() {
  harness.stateIndex = 0
  harness.refIndex = 0
  const wrapper = EquipmentPhotoGallery(props)
  return (wrapper.type as (value: typeof props) => ReactElement)(wrapper.props)
}
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  if (Array.isArray(node)) return node.flatMap(nodes)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<NodeProps>
  return [element, ...nodes(element.props.children)]
}
function button(tree: ReactNode, label: string) {
  const found = nodes(tree).find((node) => node.type === 'button' && (node.props.children === label || node.props['aria-label'] === label))
  if (!found) throw new Error(`Button missing: ${label}`)
  return found
}

beforeEach(() => {
  harness.states = []; harness.refs = []; harness.stateIndex = 0; harness.refIndex = 0
  harness.query = { data: DATA }
  harness.options = null
  harness.mutate.mockClear(); harness.setQueryData.mockClear(); harness.invalidateQueries.mockClear()
})

describe('Equipment gallery action handlers', () => {
  it('viewing another photo does not write; repeated save clicks issue only one mutation and no optimistic cover', () => {
    button(render(), 'Открыть фото 2').props.onClick?.()
    expect(harness.mutate).not.toHaveBeenCalled()
    const save = button(render(), 'Сделать обложкой')
    save.props.onClick?.(); save.props.onClick?.()
    expect(harness.mutate).toHaveBeenCalledExactlyOnceWith({ photoId: 'p2', version: 'server-version' })
    expect(harness.setQueryData).not.toHaveBeenCalled()
    expect(DATA.mainPhotoId).toBe('p1')
  })
  it('uses the server response and invalidates card, mobile, list and location caches', async () => {
    render()
    const confirmed = { ...DATA, mainPhotoId: 'p2', version: 'new-server-version' }
    await harness.options!.onSuccess(confirmed, { photoId: 'p2', version: 'server-version' })
    expect(harness.setQueryData).toHaveBeenCalledWith(['equipment-photos', 'eq-1', 'client-1'], confirmed)
    for (const prefix of ['equipment-list', 'mobile-equipment', 'location-card-equipment', 'location-equipment']) {
      expect(harness.invalidateQueries).toHaveBeenCalledWith({ queryKey: [prefix] })
    }
    expect(harness.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['equipment-card', 'eq-1'] })
    expect(harness.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['mobile-equipment-card', 'eq-1'] })
    expect(nodes(render()).some((node) => node.props.children === 'Обложка сохранена')).toBe(true)
  })
  it('409 explains retry and preserves the selected preview while refreshing, never claiming success', async () => {
    button(render(), 'Открыть фото 2').props.onClick?.()
    render()
    await harness.options!.onError(new ApiRequestError('changed', 409))
    expect(harness.setQueryData).not.toHaveBeenCalled()
    expect(harness.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['equipment-photos', 'eq-1'] })
    expect(harness.states[0]).toBe('p2')
    expect(harness.states[1]).toContain('повторите выбор')
    expect(harness.states[1]).not.toContain('сохранена')
    harness.options!.onSettled()
    button(render(), 'Сделать обложкой').props.onClick?.()
    expect(harness.mutate).toHaveBeenCalledTimes(1)
  })
  it('does not claim the requested cover won if the confirmation already contains another choice', async () => {
    render()
    await harness.options!.onSuccess(DATA, { photoId: 'p2', version: 'server-version' })
    expect(harness.states[1]).toContain('другой сессии')
    expect(harness.states[1]).not.toContain('сохранена')
  })
  it('allows reaching every photo through bounded batches rather than eagerly mounting every image', () => {
    harness.query = { data: { ...DATA, photos: Array.from({ length: 25 }, (_, i) => ({ ...DATA.photos[0], id: `p${i + 1}` })) } }
    let tree = render()
    expect(nodes(tree).filter((node) => node.props['aria-label']?.startsWith('Открыть фото'))).toHaveLength(12)
    const more = nodes(tree).find((node) => node.type === 'button' && Array.isArray(node.props.children) && node.props.children[0] === 'Показать ещё фотографии (')
    expect(more).toBeDefined(); more!.props.onClick?.()
    tree = render()
    expect(nodes(tree).filter((node) => node.props['aria-label']?.startsWith('Открыть фото'))).toHaveLength(24)
    const next = nodes(tree).find((node) => node.type === 'button' && Array.isArray(node.props.children) && node.props.children[0] === 'Показать ещё фотографии (')
    next!.props.onClick?.()
    expect(nodes(render()).filter((node) => node.props['aria-label']?.startsWith('Открыть фото'))).toHaveLength(25)
  })
  it('keys state ownership by both equipment and company so React resets on either navigation', () => {
    const current = EquipmentPhotoGallery(props).key
    expect(EquipmentPhotoGallery({ ...props, equipmentId: 'eq-2' }).key).not.toBe(current)
    expect(EquipmentPhotoGallery({ ...props, scopeCompanyId: 'client-2' }).key).not.toBe(current)
  })
})
