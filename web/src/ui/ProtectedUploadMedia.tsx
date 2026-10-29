import { useState } from 'react'
import type { CSSProperties, ImgHTMLAttributes, ReactNode, VideoHTMLAttributes } from 'react'
import { useProtectedUploadSource, useProtectedUploadSrc } from './useProtectedUploadSrc'

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  url: string
  loadingFallback?: ReactNode
  errorFallback?: ReactNode
}

export function ProtectedUploadImg({ url, alt = '', loadingFallback, errorFallback, onError, ...rest }: ImgProps) {
  const source = useProtectedUploadSource(url)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  if (source.failed || failedUrl === url) return errorFallback ?? null
  if (!source.src) return loadingFallback ?? null
  return <img src={source.src} alt={alt} {...rest} onError={(event) => {
    if (errorFallback !== undefined) setFailedUrl(url)
    onError?.(event)
  }} />
}

type VideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  url: string
}

export function ProtectedUploadVideo({ url, ...rest }: VideoProps) {
  const src = useProtectedUploadSrc(url)
  if (!src) return null
  return <video src={src} {...rest} />
}

type ThumbLinkProps = {
  url: string
  alt?: string
  imgClassName?: string
  imgStyle?: CSSProperties
  className?: string
  style?: CSSProperties
}

export function ProtectedUploadThumbLink({
  url,
  alt = '',
  imgClassName,
  imgStyle,
  className,
  style,
}: ThumbLinkProps) {
  const src = useProtectedUploadSrc(url)
  if (!src) return null
  return (
    <a href={src} target="_blank" rel="noreferrer" className={className} style={style}>
      <img src={src} alt={alt} className={imgClassName} style={imgStyle} />
    </a>
  )
}

type AnchorProps = {
  url: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function ProtectedUploadAnchor({ url, className, style, children }: AnchorProps) {
  const src = useProtectedUploadSrc(url)
  if (!src) return <span className={className} style={style}>{children}</span>
  return (
    <a href={src} target="_blank" rel="noreferrer" className={className} style={style}>
      {children}
    </a>
  )
}
