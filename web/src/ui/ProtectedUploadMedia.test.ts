import { createElement } from 'react'
import type { ImgHTMLAttributes, ReactElement, SyntheticEvent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedUploadImg } from './ProtectedUploadMedia'
import { useProtectedUploadSource } from './useProtectedUploadSrc'
const { setFailedUrl } = vi.hoisted(() => ({ setFailedUrl: vi.fn() }))
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: () => [null, setFailedUrl],
}))
vi.mock('./useProtectedUploadSrc', () => ({ useProtectedUploadSource: vi.fn(), useProtectedUploadSrc: vi.fn() }))
const render = () => renderToStaticMarkup(createElement(ProtectedUploadImg, {
  url: '/uploads/equipment/private.jpg', alt: 'Котёл', loadingFallback: 'Загрузка', errorFallback: 'Ошибка фото',
}))
describe('Protected image loading/error presentation', () => {
  beforeEach(() => { vi.mocked(useProtectedUploadSource).mockReset(); setFailedUrl.mockReset() })
  it('shows an explicit skeleton while the authenticated source is loading', () => {
    vi.mocked(useProtectedUploadSource).mockReturnValue({ src: '', loading: true, failed: false })
    expect(render()).toBe('Загрузка')
  })
  it('shows an image failure rather than an empty success', () => {
    vi.mocked(useProtectedUploadSource).mockReturnValue({ src: '', loading: false, failed: true })
    expect(render()).toBe('Ошибка фото')
  })
  it('preserves a legacy consumer custom onError without latching a null fallback', () => {
    vi.mocked(useProtectedUploadSource).mockReturnValue({ src: 'blob:photo', loading: false, failed: false })
    const onError = vi.fn()
    const node = ProtectedUploadImg({ url: '/uploads/equipment/private.jpg', onError }) as ReactElement<ImgHTMLAttributes<HTMLImageElement>>
    const event = { type: 'error' } as SyntheticEvent<HTMLImageElement>
    node.props.onError?.(event)
    expect(onError).toHaveBeenCalledWith(event)
    expect(setFailedUrl).not.toHaveBeenCalled()
  })
  it('latches decoding failure only when an explicit image error fallback is supplied', () => {
    vi.mocked(useProtectedUploadSource).mockReturnValue({ src: 'blob:photo', loading: false, failed: false })
    const node = ProtectedUploadImg({ url: '/uploads/equipment/private.jpg', errorFallback: 'Ошибка фото' }) as ReactElement<ImgHTMLAttributes<HTMLImageElement>>
    node.props.onError?.({ type: 'error' } as SyntheticEvent<HTMLImageElement>)
    expect(setFailedUrl).toHaveBeenCalledWith('/uploads/equipment/private.jpg')
  })
  it('renders only the authenticated blob source', () => {
    vi.mocked(useProtectedUploadSource).mockReturnValue({ src: 'blob:authenticated-photo', loading: false, failed: false })
    const html = render()
    expect(html).toContain('src="blob:authenticated-photo"')
    expect(html).not.toContain('/uploads/')
    expect(html).not.toMatch(/loadingFallback|errorFallback/)
  })
})
