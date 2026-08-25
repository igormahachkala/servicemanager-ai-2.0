/**
 * i18n guard — enforces the localization policy: user-facing Cyrillic text must live
 * in src/i18n/ (translation bundles), never hardcoded in components/data/seed. Keeps
 * "fully RU or fully EN" from regressing. See i18nGuard.test.ts for the ratchet.
 */
export function hasCyrillic(text: string): boolean {
  return /[А-Яа-яЁё]/.test(text)
}
