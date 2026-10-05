import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import { readServerMediaBlob } from '../mobile/offline/serverMediaCache'

export type ProtectedUploadSource = {
  src: string
  loading: boolean
  failed: boolean
}

/** IDB имеет приоритет. Сеть используется только если оригинала на устройстве нет. */
export async function loadProtectedUploadBlob(url: string): Promise<Blob | null> {
  const cached = await readServerMediaBlob(url)
  if (cached) return cached
  return api.fetchProtectedUploadBlob(url)
}

/**
 * For protected /uploads/* URLs loads the file with Authorization and returns
 * a blob: URL. Revokes it on change/unmount. Non-protected URLs pass through.
 */
export function useProtectedUploadSource(url: string): ProtectedUploadSource {
  const passthrough = url && !api.isProtectedUploadUrl(url) ? url : ''
  const [state, setState] = useState<ProtectedUploadSource>(() => ({
    src: passthrough,
    loading: Boolean(url) && !passthrough,
    failed: false,
  }))

  useEffect(() => {
    if (!url) {
      setState({ src: '', loading: false, failed: false })
      return
    }
    if (!api.isProtectedUploadUrl(url)) {
      setState({ src: url, loading: false, failed: false })
      return
    }

    let cancelled = false
    let objectUrl = ''
    setState({ src: '', loading: true, failed: false })
    void loadProtectedUploadBlob(url).then((blob) => {
      if (cancelled) return
      if (!blob) {
        setState({ src: '', loading: false, failed: true })
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setState({ src: objectUrl, loading: false, failed: false })
    }).catch(() => {
      if (!cancelled) setState({ src: '', loading: false, failed: true })
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return state
}

export function useProtectedUploadSrc(url: string): string {
  return useProtectedUploadSource(url).src
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
        const blob = await loadProtectedUploadBlob(url)
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
