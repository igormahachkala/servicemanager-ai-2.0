# Documentation Center V1

Status: Active
Scope: frontend-only authenticated Documentation Center for Сервис Менеджер.

## Purpose

Documentation Center V1 gives authenticated users one stable place for concise
product help:

- first login and workspace selection;
- daily ticket workflows;
- administrator and executor guidance;
- FAQ and glossary;
- legal-content status;
- support contacts.

The center is intentionally static in V1. It does not add backend endpoints,
database tables, Prisma migrations, upload flows, an editor, or a public legal
site.

## Routes

Authenticated routes:

- `/docs`
- `/docs/quick-start`
- `/docs/user-guide`
- `/docs/admin-guide`
- `/docs/executor-guide`
- `/docs/faq`
- `/docs/glossary`
- `/docs/legal`
- `/docs/support`

The routes are mounted under the existing desktop `Shell`, so unauthenticated
access follows the existing auth model and redirects to `/login`.

Mobile does not get a second content system. Mobile users enter the same
adaptive `/docs` route from profile/settings links.

## Catalog Structure

Frontend source:

- `web/src/docs-center/docsTypes.ts`
- `web/src/docs-center/docsCatalog.ts`
- `web/src/docs-center/docsSearch.ts`
- `web/src/docs-center/DocumentationCenterPage.tsx`
- `web/src/docs-center/DocumentationArticlePage.tsx`
- `web/src/docs-center/docs-center.css`

Each article has:

- `id` — stable document id, for example `docs.quick-start`;
- `slug` — route segment;
- `title`;
- `summary`;
- `section`;
- `audience`;
- `keywords`;
- `anchors`;
- `content` blocks.

## Stable IDs and Anchors

Document IDs and anchors are part of the future integration contract for Guided
Tour and Context Help. Do not rename an existing `id`, `slug`, or anchor unless
the dependent entry point is migrated in the same change.

Recommended convention:

- document id: `docs.<topic>`;
- route slug: kebab-case topic name;
- anchor id: kebab-case section name.

## Adding Articles

When adding or updating an article:

1. Add the section metadata if the section is new.
2. Add the article to `DOCS_ARTICLES`.
3. Use content blocks instead of raw HTML.
4. Add keywords in Russian and common product terms.
5. Keep anchors short and stable.
6. Check `/docs` search by title, keyword, and content text.
7. Run the frontend checks from the task or PR.

## Factual Accuracy Rules

Documentation may describe only behavior that is confirmed in the current code
or current product acceptance.

Do not claim:

- features that do not exist;
- public registration availability;
- legal approval;
- certification;
- compliance guarantees;
- AI Company functionality in Сервис Менеджер user docs.

If a feature is planned but not implemented, mark it as planned or omit it from
user-facing docs.

## Support Contacts

Support links must use the shared frontend component:

- `web/src/components/SupportContactBlock.tsx`
- `web/src/lib/supportUrls.ts`

Do not duplicate Telegram or MAX URLs in Documentation Center content.

## Legal Content Rules

The legal section in V1 is a status page only:

- official legal texts are being prepared;
- final texts require separate approval;
- no fake policies, consent texts, certificates, licenses, or compliance claims.

Current project terminology:

- product: `Сервис Менеджер`;
- developer brand: `СМА-Тех`;
- temporary rights holder term: `ИП Ермаков И. А.`;
- full legal details remain out of V1 until approved.

## Future Integrations

V1 is prepared for:

- links from Mobile Guided Tour;
- contextual help links from pages and forms;
- stable article anchors from UI hints;
- future backend-backed acceptance tracking or CMS, if approved later.

Those integrations must not change the V1 rule that product help remains
factual and does not bypass backend permissions.

## V1 Limitations

- No backend API.
- No Prisma/schema changes.
- No database persistence.
- No admin editor.
- No public legal routes.
- No document acceptance tracking.
- No per-tenant customization.
- No server-side search.
