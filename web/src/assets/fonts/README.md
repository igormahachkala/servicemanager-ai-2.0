# Шрифты

Локальные вариативные шрифты вместо `@import` с `fonts.googleapis.com`.
Дефект B-01 в `_claude/tasks/web-site-troubleshooting/bugs-registry-2026-08-24.md`.

| Файл | Гарнитура | Размер |
|---|---|---|
| `inter-latin-cyrillic.woff2` | Inter | 57 КБ |
| `jetbrains-mono-latin-cyrillic.woff2` | JetBrains Mono | 35 КБ |

Подключены в `web/src/index.css` через `@font-face` с относительным путём.
Vite сам добавляет хеш в имя файла при сборке.

## Как собраны

Исходники — вариативные TTF из архивов с fonts.google.com.
У Inter ось `opsz` закреплена на значении 14, ось `wght` ограничена
диапазоном 400-700 — используемым в интерфейсе. Подмножество символов:
latin и cyrillic по границам Google Fonts, без latin-ext, greek и vietnamese.

```bash
pip install fonttools brotli

fonttools varLib.instancer 'Inter-VariableFont_opsz,wght.ttf' \
  opsz=14 wght=400:700 -o inter-instanced.ttf

U='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'

pyftsubset inter-instanced.ttf --unicodes="$U" --layout-features='*' \
  --flavor=woff2 --output-file=inter-latin-cyrillic.woff2
```

Для JetBrains Mono то же самое без закрепления `opsz` — этой оси у неё нет.

## Курсив

Курсивные начертания не подключены: в коде два вхождения `font-style: italic`,
браузер синтезирует наклон из прямого начертания. Подключение курсива добавит
около 90 КБ ради двух мест.

## Лицензия

SIL Open Font License 1.1. Тексты в `OFL-Inter.txt` и `OFL-JetBrainsMono.txt`.
