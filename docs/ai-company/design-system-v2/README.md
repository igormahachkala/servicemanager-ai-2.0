# AI Company — Design System V2

Design-only package for **AI-COMPANY-032**. No code changes.

## Documents

| File | Purpose |
|------|---------|
| [AI-COMPANY-032-design-system-v2.md](../AI-COMPANY-032-design-system-v2.md) | Master spec — vision, IA, layouts, pages, themes |
| [components.md](./components.md) | UI kit & component catalog |
| [figma-library.md](./figma-library.md) | Figma file structure & handoff |
| [tokens.json](./tokens.json) | Design tokens (Dark + Light) |

## Quick start (designers)

1. Read the master spec §1–6 for vision and navigation.
2. Import `tokens.json` into Figma Variables (or Tokens Studio).
3. Build components from `components.md` following `figma-library.md` page structure.
4. Create reference screens listed in Figma doc Priority 1.

## Quick start (engineers — future tasks)

Do not implement from this folder directly in task 032. When implementing:

- Map semantic tokens to CSS variables (`--ac-*` evolution).
- Preserve existing routes; use L1 mapping table in master spec §6.
- Implement Living Company widgets before cosmetic polish.
