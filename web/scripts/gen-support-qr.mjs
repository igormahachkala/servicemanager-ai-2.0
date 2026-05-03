import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../src/assets')
const outFile = join(outDir, 'support-qr.png')

/** Публичная ссылка на поддержку (совпадает с LoginPage SUPPORT_TELEGRAM). */
const SUPPORT_URL = 'https://t.me/igorpump'

mkdirSync(outDir, { recursive: true })
if (existsSync(outFile)) process.exit(0)

await QRCode.toFile(outFile, SUPPORT_URL, {
  width: 320,
  margin: 2,
  color: { dark: '#111827', light: '#ffffff' },
})
