/**
 * Раньше генерировались QR для email/Telegram.
 * Контакты поддержки: Telegram и MAX — см. web/src/lib/supportUrls.ts
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(__dirname, '../src/assets')
mkdirSync(assetsDir, { recursive: true })
