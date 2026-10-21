/**
 * Office server: the panel is opened by LAN IP (http://192.168.1.157:8080), so
 * window.location.origin is a raw IP. The registry must still load — the raw-IP
 * guard is for configured values only (STATE §7.9).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

;(globalThis as { window?: unknown }).window = {
  location: { origin: 'http://192.168.1.157:8080' },
  localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
  dispatchEvent: () => true,
}

test('registry loads and cursor falls back to the LAN-IP origin', async () => {
  const { getToolCapability } = await import('./index.ts')
  assert.equal(getToolCapability('cursor')?.endpoint.baseUrl, 'http://192.168.1.157:8080')
  assert.equal(getToolCapability('ollama')?.endpoint.baseUrl, 'http://192.168.1.157:8080')
})

test('an explicitly configured raw IP is still rejected', async () => {
  const { assertToolEndpointHasNoRawIp } = await import('./index.ts')
  assert.throws(() => assertToolEndpointHasNoRawIp('http://192.168.1.157:11434'))
})
