import { useEffect, useState } from 'react'
import * as api from '../lib/api'

/**
 * For protected /uploads/* URLs loads the file with Authorization and returns
 * a blob: URL. Revokes it on change/unmount. Non-protected URLs pass through.
 */
export function useProtectedUploadSrc(url: string): string {
  const [src, setSrc] = useState(() => (url && !api.isProtectedUploadUrl(url) ? url : ''))

  useEffect(() => {
    if (!url) {
      setSrc('')
      return
    }
    if (!api.isProtectedUploadUrl(url)) {
      setSrc(url)
      return
    }

    let cancelled = false
    let objectUrl = ''
    setSrc('')
    void api.fetchProtectedUploadBlob(url).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setSrc(objectUrl)
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return src
}

/** Same as useProtectedUploadSrc, for a stable list of URLs (viewer galleries). */
export function useProtectedUploadSrcs(urls: string[]): string[] {
  const key = urls.join('\n')
  const [srcs, setSrcs] = useState<string[]>(() => urls.map((url) => (url && !api.isProtectedUploadUrl(url) ? url : '')))

  useEffect(() => {
    const list = key ? key.split('\n') : []
    if (list.length === 0) {
      setSrcs([])
      return
    }

    let cancelled = false
    const objectUrls: string[] = []
    setSrcs(list.map((url) => (url && !api.isProtectedUploadUrl(url) ? url : '')))

    void Promise.all(
      list.map(async (url) => {
        if (!url || !api.isProtectedUploadUrl(url)) return url
        const blob = await api.fetchProtectedUploadBlob(url)
        if (!blob || cancelled) return ''
        const objectUrl = URL.createObjectURL(blob)
        objectUrls.push(objectUrl)
        return objectUrl
      }),
    ).then((next) => {
      if (cancelled) {
        for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
        return
      }
      setSrcs(next)
    })

    return () => {
      cancelled = true
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl)
    }
  }, [key])

  return srcs
}
