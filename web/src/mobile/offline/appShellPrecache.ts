export const APP_SHELL_LIVE = 'sma-app-shell-v4'
export const APP_SHELL_NEXT = 'sma-app-shell-next'
export const APP_SHELL_URL = '/index.html'
export const BUILD_ASSET_MANIFEST_URL = '/asset-manifest.json'

export type ManifestEntry = {
  file?: string
  src?: string
  isEntry?: boolean
  css?: string[]
  assets?: string[]
  imports?: string[]
  dynamicImports?: string[]
}

export type BuildManifest = Record<string, ManifestEntry>

export function isWasmPath(path: string): boolean {
  return /\.wasm$/i.test(path)
}

export function isExcludedShellSrc(key: string): boolean {
  return (
    key.startsWith('src/views/') ||
    key.startsWith('src/it-company/') ||
    key.startsWith('src/max/') ||
    key.startsWith('src/pages/') ||
    key === 'src/ui/Shell.tsx'
  )
}

export function isIncludedShellSrc(key: string): boolean {
  return key.startsWith('src/mobile/') || key.startsWith('src/assets/')
}

export function toAssetUrl(value: string): string {
  return value.startsWith('/') ? value : `/${value}`
}

export function addEntryUrls(urls: Set<string>, entry: ManifestEntry | undefined): void {
  if (!entry) return
  for (const value of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    if (!value) continue
    if (isWasmPath(value)) continue
    urls.add(toAssetUrl(value))
  }
}

export function requiredShellUrls(manifest: BuildManifest): string[] {
  const urls = new Set<string>([APP_SHELL_URL, '/', '/m', BUILD_ASSET_MANIFEST_URL])
  const seen = new Set<string>()
  const queue: string[] = []

  for (const [key, entry] of Object.entries(manifest)) {
    if (entry?.isEntry) {
      addEntryUrls(urls, entry)
      for (const dep of entry.imports || []) {
        if (dep && !isExcludedShellSrc(dep)) queue.push(dep)
      }
    }
    if (isIncludedShellSrc(key)) queue.push(key)
  }

  while (queue.length) {
    const key = queue.pop()!
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

export function leftoverFromOtherBuild(cachedPaths: string[], required: string[]): boolean {
  const req = new Set(required)
  return cachedPaths.some((path) => path.startsWith('/assets/') && !req.has(path))
}

export function missingRequired(cachedPaths: string[], required: string[]): string[] {
  const have = new Set(cachedPaths)
  return required.filter((url) => !have.has(url))
}

export function canPromoteShell(cachedPaths: string[], required: string[]): boolean {
  return missingRequired(cachedPaths, required).length === 0
}
