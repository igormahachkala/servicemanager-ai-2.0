const APP_SHELL_CACHE = 'sma-app-shell-v4'
const APP_SHELL_NEXT = 'sma-app-shell-next'
const APP_SHELL_URL = '/index.html'
const BUILD_ASSET_MANIFEST_URL = '/asset-manifest.json'
const PRECACHE_CONCURRENCY = 4

function isWasmPath(path) {
  return /\.wasm$/i.test(path)
}

function isExcludedShellSrc(key) {
  return (
    key.startsWith('src/views/') ||
    key.startsWith('src/it-company/') ||
    key.startsWith('src/max/') ||
    key.startsWith('src/pages/') ||
    key === 'src/ui/Shell.tsx'
  )
}

function isIncludedShellSrc(key) {
  return key.startsWith('src/mobile/') || key.startsWith('src/assets/')
}

function toAssetUrl(value) {
  return value.startsWith('/') ? value : `/${value}`
}

function addEntryUrls(urls, entry) {
  if (!entry || typeof entry !== 'object') return
  for (const value of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    if (!value || typeof value !== 'string') continue
    if (isWasmPath(value)) continue
    urls.add(toAssetUrl(value))
  }
}

function requiredShellUrls(manifest) {
  const urls = new Set([APP_SHELL_URL, '/', '/m', BUILD_ASSET_MANIFEST_URL])
  const seen = new Set()
  const queue = []

  for (const [key, entry] of Object.entries(manifest || {})) {
    if (entry && entry.isEntry) {
      addEntryUrls(urls, entry)
      for (const dep of entry.imports || []) {
        if (dep && !isExcludedShellSrc(dep)) queue.push(dep)
      }
    }
    if (isIncludedShellSrc(key)) queue.push(key)
  }

  while (queue.length) {
    const key = queue.pop()
    if (seen.has(key) || isExcludedShellSrc(key)) continue
    seen.add(key)
    const entry = manifest[key]
    if (!entry) continue
    addEntryUrls(urls, entry)
    for (const dep of [...(entry.imports || []), ...(entry.dynamicImports || [])]) {
      if (!dep || seen.has(dep) || isExcludedShellSrc(dep)) continue
      queue.push(dep)
    }
  }

  return [...urls].sort()
}

function cacheRequestPath(request) {
  try {
    const url = new URL(request.url)
    return `${url.pathname}${url.search}`
  } catch {
    return ''
  }
}

async function listCachedPaths(cache) {
  const keys = await cache.keys()
  return keys.map((request) => cacheRequestPath(request)).filter(Boolean)
}

function leftoverFromOtherBuild(cachedPaths, required) {
  const req = new Set(required)
  return cachedPaths.some((path) => path.startsWith('/assets/') && !req.has(path))
}

function missingRequired(cachedPaths, required) {
  const have = new Set(cachedPaths)
  return required.filter((url) => !have.has(url))
}

async function putMissingUrl(cache, url) {
  const existing = await cache.match(url)
  if (existing) return true
  try {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return false
    await cache.put(url, response)
    return true
  } catch {
    return false
  }
}

async function putMissingUrls(cache, urls) {
  for (let i = 0; i < urls.length; i += PRECACHE_CONCURRENCY) {
    const slice = urls.slice(i, i + PRECACHE_CONCURRENCY)
    await Promise.all(slice.map((url) => putMissingUrl(cache, url)))
  }
}

async function copyNextToLive(next) {
  const live = await caches.open(APP_SHELL_CACHE)
  const keys = await next.keys()
  for (const request of keys) {
    const response = await next.match(request)
    if (response) await live.put(request, response)
  }
  return live
}

async function precacheApplication() {
  const manifestResponse = await fetch(BUILD_ASSET_MANIFEST_URL, { cache: 'no-store' })
  if (!manifestResponse.ok) throw new Error('Build asset manifest is unavailable')
  const manifest = await manifestResponse.json()
  const required = requiredShellUrls(manifest)
  const assetUrls = required.filter((url) => url.startsWith('/assets/') || url === BUILD_ASSET_MANIFEST_URL)

  let next = await caches.open(APP_SHELL_NEXT)
  const cached = await listCachedPaths(next)
  if (leftoverFromOtherBuild(cached, required)) {
    await caches.delete(APP_SHELL_NEXT)
    next = await caches.open(APP_SHELL_NEXT)
  }

  await putMissingUrls(next, assetUrls)
  const have = await listCachedPaths(next)
  const missing = missingRequired(have, assetUrls)
  if (missing.length) throw new Error('App shell precache incomplete')

  const live = await copyNextToLive(next)
  for (const url of [APP_SHELL_URL, '/', '/m']) {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Unable to promote ${url}`)
    await live.put(url, response)
  }
  await caches.delete(APP_SHELL_NEXT)
  if (typeof self.skipWaiting === 'function') await self.skipWaiting()
  return true
}
