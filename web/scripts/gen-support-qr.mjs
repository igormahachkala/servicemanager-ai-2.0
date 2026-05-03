import { mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '../src/assets')

/** Синхронизировать с web/src/components/SupportQrModal.tsx */
const SUPPORT_TELEGRAM_URL = 'https://t.me/igorpump'
const SUPPORT_CONTACT_EMAIL = 'ai.service.manager.ufa@gmail.com'
const SUPPORT_MAILTO_HREF = `mailto:${SUPPORT_CONTACT_EMAIL}`

const telegramOut = join(outDir, 'support-qr.png')
const emailOut = join(outDir, 'support-email-qr.png')

const qrOptions = {
  width: 320,
  margin: 2,
  color: { dark: '#111827', light: '#ffffff' },
}

mkdirSync(outDir, { recursive: true })

if (!existsSync(telegramOut)) {
  await QRCode.toFile(telegramOut, SUPPORT_TELEGRAM_URL, qrOptions)
}

if (!existsSync(emailOut)) {
  await QRCode.toFile(emailOut, SUPPORT_MAILTO_HREF, qrOptions)
}
