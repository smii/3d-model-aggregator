# 3D Model Search & Aggregator PRD

## Core Objective
A single-pane-of-glass dashboard that aggregates search across 3D printable model platforms AND provides an automated account-sync feature via Google/Gmail OAuth & headless browser automation to import user collections and likes from external sites into one place.

## Architecture
- Frontend: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons, TypeScript.
- Auth Layer: NextAuth.js / Auth.js (Google OAuth, JWT sessions) — used for account sync; search and local favorites work without signing in.
- Backend & Automation: Next.js API Routes, Playwright (headless browser engine for cross-site cookie/session sync), in-process background job runner for scraper imports (tracked in the `SyncJob` table).
- Database: Prisma ORM — SQLite in local dev (`prisma/dev.db`), PostgreSQL in production. Stores users, encrypted platform credentials, synchronized collections, and the local favorites database.

## Platform Coverage
Search adapters live in `src/lib/aggregator/` behind a common `SearchAdapter` interface and run concurrently.

| Platform | Search | Category filter | Notes |
|---|---|---|---|
| Printables | ✅ | ✅ all 10 | Undocumented GraphQL API; category-tree node ids discovered empirically |
| Thingiverse | ✅ | — | Official API, needs `THINGIVERSE_APP_TOKEN` |
| MakerWorld | ✅ | — | Web JSON API; ignores all category parameters |
| GrabCAD | ✅ | ✅ 7 of 10 | Community library JSON endpoint; requires browser User-Agent |
| Cults3D | ✅ (untested) | — | Official GraphQL API, needs `CULTS3D_USERNAME` + `CULTS3D_API_KEY` |
| MyMiniFactory | ✅ (untested) | — | Official REST API, needs `MYMINIFACTORY_API_KEY` |
| Thangs | ❌ | — | Cloudflare bot challenge blocks all server-side access |
| Creality Cloud | ❌ | — | Search results gated behind Cloudflare bot tokens |

Unavailable platforms are shown disabled ("n/a") in the UI rather than failing silently.

## Scope
1. Unified Search UI: Search bar, multi-platform filter checkboxes, grid view layout, dark theme.
2. Parallel Search Adapters: Concurrent scrapers/API adapters (see Platform Coverage) merged round-robin with per-platform failure reporting.
3. Multipage Results: Prev/Next pagination driven by a `page` parameter passed through to every adapter.
4. Category Filter: 10 unified categories (`ModelCategory` in `src/types/model.ts`): Toys & Games, Art & Design, Gadgets, Tools, Household, Hobby & DIY, Fashion, Learning, Tabletop Miniatures, Sports & Outdoor. Filtering is native-only: platforms whose APIs cannot filter by category are excluded from category-filtered searches and reported in a UI notice (never polluted with unfiltered results).
5. Local Favorites Database: Heart any search result to save it to a local, installation-wide favorites table (`FavoriteModel`) — deliberately unauthenticated and not tied to user accounts. Favorites can be assigned one of the 10 categories (auto-inherited from an active category filter on save), and the Favorites page offers category/platform/text filtering plus per-card recategorize and remove. CRUD via `/api/favorites`.
6. OAuth & Single Sign-On: Google/Gmail login to create a core user session (required only for account sync/import).
7. Account Import Agent: Background Playwright worker that uses linked user sessions/cookies (or OAuth tokens) to log into 3D sites and scrape existing "Likes" and "Collections" into `SavedModel`.
8. Unified Favorites Dashboard: View and search local favorites and imported likes across all platforms in one tab (`/favorites` and `/favorites/likes`).
