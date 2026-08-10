# Project Guidelines for Claude Code

## Tech Stack
- Next.js 15 with App Router (TypeScript)
- Tailwind CSS with dark mode aesthetic
- NextAuth.js (Auth.js) with Google OAuth (JWT sessions) — only account sync requires sign-in
- Prisma — SQLite in dev (`prisma/dev.db`, better-sqlite3 adapter), PostgreSQL in production (see notes in `prisma/schema.prisma` and `src/lib/db.ts`)
- Playwright / Axios for scraping & collection sync

## Coding Rules
- Use TypeScript strict mode everywhere.
- API requests across search adapters MUST run concurrently using `Promise.allSettled`.
- Cross-site scraping operations must run asynchronously via background workers to avoid HTTP timeouts.
- Sensible handling of session tokens: Store platform cookies securely encrypted using AES-256 in the database.
- SQLite has no enums: status/category-like columns are plain `String`s. Validate values at the API boundary (see `isModelCategory` in `src/types/model.ts`, `SyncJobStatus` in `src/lib/db.ts`).

## Architecture Notes
- Search adapters live in `src/lib/aggregator/`, one file per platform, implementing `SearchAdapter` (`src/lib/aggregator/types.ts`). They are aggregated by `searchAllPlatforms` and exposed via `GET /api/search` (params: `q`, `page`, `platforms`, `category`).
- Category filtering is native-only: an adapter opts in via `supportsCategory()`; platforms that can't filter natively are excluded from category-filtered searches and reported in the response's `skipped` list. Never emulate categories with keyword hacks.
- The unified category list (`MODEL_CATEGORIES` / `ModelCategory`) lives in `src/types/model.ts` — always validate/derive from it, never redeclare.
- Thangs and Creality Cloud have no adapters: Cloudflare bot protection blocks server-side search. They are marked `unavailable` in `src/components/SidebarFilters.tsx`.
- Local favorites (`FavoriteModel`, `/api/favorites`, `/favorites`) are deliberately unauthenticated and installation-wide — no `userId`, no session checks. This is a product decision; do not add auth to favorites. Imported platform likes are a separate concern (`SavedModel`, requires Google sign-in).
