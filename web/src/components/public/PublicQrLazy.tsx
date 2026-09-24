import { lazy, Suspense, type ComponentProps } from 'react'

const PublicQrModal = lazy(() =>
  import('./PublicQrModal').then((m) => ({ default: m.PublicQrModal })),
)

export async function downloadQrPosterPng(
  ...args: Parameters<(typeof import('./PublicQrModal'))['downloadQrPosterPng']>
) {
  const { downloadQrPosterPng: download } = await import('./PublicQrModal')
  return download(...args)
}

type PublicQrModalProps = ComponentProps<typeof PublicQrModal>

/** Loads qrcode only when the modal is open or a poster download starts. */
export function PublicQrModalLazy(props: PublicQrModalProps) {
  if (!props.open) return null
  return (
    <Suspense fallback={null}>
      <PublicQrModal {...props} />
    </Suspense>
  )
}
