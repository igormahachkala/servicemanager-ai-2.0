import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

type PublicQrModalProps = {
  open: boolean
  url: string
  title: string
  subtitle?: string | null
  fileName: string
  onClose: () => void
}

type RenderQrPosterInput = {
  url: string
  title: string
  subtitle?: string | null
}

const PRINT_LABEL = 'Service request'

function splitCenteredText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const candidate = current ? current + ' ' + word : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
  }

  if (current) lines.push(current)
  return lines
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

export async function createQrPosterDataUrl({ url, title, subtitle }: RenderQrPosterInput) {
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 520,
    color: {
      dark: '#111111',
      light: '#FFFFFF',
    },
  })

  const qrImage = await loadImage(qrDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = subtitle ? 980 : 920
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const qrSize = 520
  const qrX = Math.round((canvas.width - qrSize) / 2)
  const qrY = 54
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)

  const textWidth = canvas.width - 96
  let currentY = qrY + qrSize + 54

  ctx.fillStyle = '#111111'
  ctx.textAlign = 'center'
  ctx.font = '700 34px Arial'
  const titleLines = splitCenteredText(ctx, title, textWidth)
  for (const line of titleLines) {
    ctx.fillText(line, canvas.width / 2, currentY)
    currentY += 42
  }

  if (subtitle) {
    currentY += 8
    ctx.font = '500 24px Arial'
    ctx.fillStyle = '#334155'
    const subtitleLines = splitCenteredText(ctx, subtitle, textWidth)
    for (const line of subtitleLines) {
      ctx.fillText(line, canvas.width / 2, currentY)
      currentY += 30
    }
  }

  currentY += 12
  ctx.font = '600 20px Arial'
  ctx.fillStyle = '#64748b'
  ctx.fillText(PRINT_LABEL, canvas.width / 2, currentY)

  return canvas.toDataURL('image/png')
}

export async function downloadQrPosterPng(input: RenderQrPosterInput & { fileName: string }) {
  const dataUrl = await createQrPosterDataUrl(input)
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = input.fileName
  link.click()
}

async function copyText(value: string) {
  if (!value) return false
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    window.prompt('Скопируйте ссылку вручную', value)
    return false
  }
}

export function PublicQrModal({ open, url, title, subtitle, fileName, onClose }: PublicQrModalProps) {
  const [dataUrl, setDataUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!open || !url) {
      setDataUrl('')
      setError(null)
      return
    }

    setError(null)
    setDataUrl('')

    createQrPosterDataUrl({ url, title, subtitle })
      .then((next) => {
        if (!cancelled) setDataUrl(next)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Не удалось создать QR-код')
      })

    return () => {
      cancelled = true
    }
  }, [open, url, title, subtitle])

  if (!open) return null

  async function handleDownload() {
    try {
      setDownloading(true)
      await downloadQrPosterPng({ url, title, subtitle, fileName })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(2,6,23,0.72)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 'min(100%, 640px)',
          background: '#ffffff',
          color: '#0f172a',
          padding: 20,
          display: 'grid',
          gap: 16,
          borderRadius: 24,
          boxShadow: '0 30px 80px rgba(15,23,42,0.28)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a' }}>{title}</h3>
            {subtitle ? <div style={{ marginTop: 6, color: '#475569' }}>{subtitle}</div> : null}
          </div>
          <button type="button" className="ghost" onClick={onClose}>Закрыть</button>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid rgba(148,163,184,0.35)',
            borderRadius: 20,
            padding: 20,
            display: 'grid',
            justifyItems: 'center',
            gap: 12,
          }}
        >
          {error ? <div className="alert">{error}</div> : null}
          {!error && !dataUrl ? <div style={{ color: '#64748b' }}>Готовим QR-код...</div> : null}
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={title}
              style={{ width: 'min(100%, 420px)', borderRadius: 18, background: '#ffffff' }}
            />
          ) : null}
          <div style={{ width: '100%' }}>
            <div style={{ marginBottom: 6, color: '#64748b', fontSize: 12 }}>Ссылка</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#0f172a' }}>{url}</code>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void copyText(url)}>Скопировать ссылку</button>
          <button type="button" className="ghost" onClick={handleDownload} disabled={!url || downloading}>
            {downloading ? 'Готовим PNG...' : 'Скачать PNG'}
          </button>
        </div>
      </div>
    </div>
  )
}