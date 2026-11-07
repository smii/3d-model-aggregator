# 3Drop-inspired roadmap

- **Created:** 2026-11-06
- **Plan branch:** `plan/three-drop-integration` (this file only; every phase branches from here)
- **Origin:** competitive analysis of [3Drop](https://three-drop.com/), a cross-site 3D model search app, against this service.

## 1. What we learned about 3Drop, and how sure we are

**Verified** (App Store listing, read 2026-11-03):

- A mobile app (iOS/Android) plus a website. It searches 10 sites at once: Printables, Thingiverse, Cults3D, MakerWorld, Thangs, Maker Online, Creality Cloud, GrabCAD, NextPrint, MyMiniFactory.
- Filters by category, price and license. Sorts by relevance, popularity or upload date.
- Favorites with custom collections (by project, material or printer), synced across devices.
- Per-site login inside the app, with likes and follows synced to those accounts.
- A browser for design competitions (entries, deadlines, prizes), a model viewer, a download tracker, 7 UI languages.
- It does not host files; downloads happen on the source site. Revenue is donation-style subscriptions.

**Not verifiable:** three-drop.com returns 403 to automated clients and its robots.txt disallows AI crawlers, `/search` and `/api/`. We did not circumvent that. Whether the website queries live or keeps an index is unknown.

**Inference, not stated by 3Drop:** the per-site in-app logins, plus a changelog full of fixes ("Fix printable login issue", "Fix makerworld login issue", "Fix printables sync"), suggest requests are made from the user's own device and session. That would explain how it covers Cloudflare-protected platforms that block our server. The same changelog shows how often these integrations break.

## 2. Gap analysis

| Area | 3Drop | This service today | Plan |
|---|---|---|---|
| Platforms | 10 | 6 (Thangs, Creality Cloud blocked by Cloudflare) | P1 hand-off links, P2 Maker Online / NextPrint research |
| Sort | relevance, popularity, upload date | "Newest" (actually round-robin of each platform's native order; adapters request popularity/hotScore or the default, results carry no date), most liked, most downloaded | P1 honest `relevance` option |
| Free / paid | price filter | `freeOnly` filter already exists; only Cults3D reports prices | nothing to do |
| License | filter | filter already exists | nothing to do |
| Collections | custom lists | one `category` per favorite | P3 |
| Contests | yes | no | P4 |
| Account sync | likes + follows, 2-way | likes only, read-only, 3 platforms | P5 follows design note only; stay read-only |
| Languages | 7 | English only | P5 foundation |
| Tests / health | unknown | none | P0 |
| Duplicates across sites | not mentioned | merged cards | already ahead |
| Saved searches with new-result counts | not mentioned | yes | already ahead |

## 3. Guardrails (apply to every phase)

1. Do not use three-drop.com as a data source (403 for automated clients, robots.txt disallows it, and it would be an aggregator of an aggregator).
2. No bot-protection evasion: no stealth browsers, residential proxies, header spoofing or CAPTCHA solving to reach Thangs, Creality Cloud or any site that blocks us. Use hand-off links instead.
3. Respect each target's robots.txt and terms. Write an adapter only for an official documented API, or a public JSON endpoint the site serves to anonymous clients without a challenge. Otherwise hand-off link.
4. Category filtering stays native-only (`supportsCategory`). Adapters run concurrently with `Promise.allSettled`.
5. Favorites and collections stay unauthenticated and installation-wide (no `userId`, no session checks). This is a product decision.
6. Account sync stays read-only. Never write likes or follows back to a platform.
7. Validate at the API boundary and derive from shared constants (`MODEL_CATEGORIES`, `SortOption` values). Never redeclare lists.
8. Never commit or print secrets. Platform cookies stay AES-256-GCM encrypted.
9. `public/sw.js` already serves every `/api/*` path network-only; pages are network-first with cache fallback. Any new page that renders session data must go on the SW bypass list.
10. Nav items live only in `src/lib/nav-items.ts`. The mobile filter wrapper is `FilterDrawer.tsx`; reuse it.
11. Prisma changes must work on SQLite (dev) and PostgreSQL (prod); commit the migration.
12. No new dependencies except where a phase says so (only Phase 0 touches `package.json` / `package-lock.json`).

## 4. Phases

### Phase 0: safety net (tests and adapter health probe)

- **Branch:** `feat/3drop-p0-adapter-tests`
- **Why:** adapters call undocumented third-party endpoints and the repo has no tests. 3Drop's own changelog shows how often these break.
- **Scope:**
  - Add Vitest as a dev dependency with `npm test` and `npm run test:watch`, and a config with the `@/` alias mapped to `src`.
  - Unit tests for `dedupe.ts`, `duplicate-groups.ts`, `crypto.ts` (round trip, tampered payload throws, bad key length), `resolveSearchAdapters` and `searchAllPlatforms` (partial failure goes to `failures`, category skip goes to `skipped`), and the saved-search new-result diff.
  - Extract the diff out of `src/app/api/saved-searches/run/route.ts` into a pure function (`src/lib/saved-searches/diff.ts`) with identical behavior. Share one `resultKey` helper instead of the two copies in `aggregator/index.ts` and `run/route.ts`.
  - Adapter tests per platform with `fetch` stubbed and hand-written fixtures shaped like each adapter's response types: happy-path mapping to `UnifiedModelResult`, empty result, HTTP error, missing-credential error (Thingiverse, Cults3D, MyMiniFactory), `supportsCategory` truth table. Fixtures are synthetic, not live recordings; say so in the file headers.
  - `scripts/probe-adapters.ts` with `npm run probe` (add `tsx` as a dev dependency): run every adapter once (default query `benchy`, override via argv) and print platform, status (ok / failed / skipped: missing credentials), result count, latency, first title, error summary. Exit 1 if any non-skipped adapter failed. **CLI only, never an HTTP route**: an unauthenticated route that fans out to every platform is an abuse vector.
- **Out of scope:** CI workflows, changing adapter behavior, the unauthenticated `/api/saved-searches/run` and `/api/preview` endpoints (separate security review).
- **Done when:** `npm test`, `npx tsc --noEmit` and `npm run lint` are clean; the route refactor does not change behavior; the probe reports platforms without keys as skipped, not failed.

### Phase 1: parity quick wins

- **Branch:** `feat/3drop-p1-handoff-sort`
- **Scope:**
  - **(a) Hand-off links.** Thangs and Creality Cloud are already in `SourcePlatform` and marked `unavailable` in `src/components/SidebarFilters.tsx`. When a query is active, show "Also search on: Thangs ↗ Creality Cloud ↗" linking to each platform's own search page with the query pre-filled (new tab, `rel="noopener noreferrer"`, query URL-encoded). Keep the URL patterns in one table, `src/lib/handoff.ts` (platform, label, `searchUrl(query)`, `verified` flag). Verify each pattern (web search, platform docs). If a pattern can't be verified, link to the platform's site root and set `verified: false`; say so in the report. No server-side requests to those sites.
  - **(b) Honest sort.** Today's default "Newest" is not by date: `mergeResults` in `src/lib/aggregator/index.ts` interleaves each platform's native order and results carry no date. Add a `relevance` option (the interleaved order, no re-sorting), make it the default on the search page, and remove the misleading "Newest" label from the UI. Keep `newest` accepted as a legacy alias for `relevance` (saved searches store it, default `"newest"`, no migration). Put the allowed values in one exported const and use it in `SidebarFilters.tsx`, `src/app/page.tsx` and `src/app/api/saved-searches/route.ts` (which currently hard-codes the list).
- **Not doing:** a free-only toggle (already exists as `freeOnly`); true date sorting (needs creation dates from every platform, see open questions).
- **Done when:** hand-off strip appears only when a query is active; sort works end to end including saved searches; tsc, lint and build pass.

### Phase 2: additional platforms (Maker Online, NextPrint)

- **Branch:** `feat/3drop-p2-new-platforms`
- **Scope:**
  - Commit a research report at `docs/plans/research/phase-2-platforms.md`. Per platform: official API (docs URL, auth)? anonymous JSON endpoints used by the site itself? robots.txt and terms stance on automated access? does it serve a bot challenge? category support? fields available (title, author, thumbnail, likes, downloads, license, price)? verdict: ADAPTER or HAND-OFF (with the search URL pattern).
  - Build an adapter only on a green light under guardrail 3. It follows the `SearchAdapter` contract: one file in `src/lib/aggregator/`, uses `fetchJson`, `supportsCategory` only if native, registered in `DEFAULT_ADAPTERS` and `ADAPTERS_BY_PLATFORM`; extend `SourcePlatform` and the platform list in `SidebarFilters.tsx`; new env vars go in `.env.example`.
  - Hand-off verdicts: no code. The entry goes into `src/lib/handoff.ts` after Phase 1 merges.
- **Out of scope:** bypassing blocks, login-gated scraping, adding a test framework (Phase 0 owns it; add tests for the new adapter after Phase 0 merges).
- **Done when:** report committed; any adapter smoke-tested with one live request and failing gracefully when blocked or missing a key; tsc and lint pass.

### Phase 3: favorite collections

- **Branch:** `feat/3drop-p3-collections`
- **Scope:**
  - Prisma: `FavoriteCollection` (id, name, timestamps) and `FavoriteCollectionItem` (`collectionId`, `favoriteId`, `createdAt`, `@@id([collectionId, favoriteId])`, cascade on both sides). Migration via `prisma migrate dev --name add_favorite_collections`, valid on PostgreSQL too. `FavoriteModel.category` stays; collections are additive and many-to-many.
  - API, unauthenticated and installation-wide like `/api/favorites`: `GET/POST /api/collections`, `PATCH/DELETE /api/collections/[id]`, `POST/DELETE /api/collections/[id]/items`. Trim names, 1 to 60 characters, case-insensitive uniqueness, correct 400/404/409.
  - UI in `FavoritesBrowser.tsx`: collection filter that combines with the category filter, "Add to collection" picker on a favorite with inline create, rename and delete. Reuse `FilterDrawer` and the `FavoriteCategoryModal` patterns. Include collection names in `export-favorites.ts` if natural.
- **Done when:** migration applies to a fresh SQLite DB; CRUD verified with curl against a dev server; deleting a favorite removes its memberships; deleting a collection keeps the favorites; tsc, lint and build pass.

### Phase 4: contests

- **Branch:** `feat/3drop-p4-contests`
- **Scope:**
  - Research which platforms publish contests or challenges through a legitimate public source (Printables, MakerWorld, Thingiverse, Cults3D, MyMiniFactory). Report at `docs/plans/research/phase-4-contests.md`.
  - `/contests` page plus `src/lib/contests/` with a `ContestSource` interface (platform, title, url, optional deadline, prize, image, status). Implement sources only for legitimate endpoints; server-side fetch with about an hour of revalidation; failures isolated per source with `Promise.allSettled`.
  - Fallback if no legitimate source exists: `/contests` renders curated outbound links ("Browse contests on X ↗") from a static table. No scraping.
  - Add the route to `src/lib/nav-items.ts` (lucide `Trophy`) and check that `MobileNav` still fits.
- **Done when:** the page renders (at minimum the static fallback); each live source smoke-tested; tsc, lint and build pass.

### Phase 5: i18n foundation and follows design

- **Branch:** `feat/3drop-p5-i18n-follows`
- **Scope:**
  - **(a) i18n, no new dependencies.** `src/lib/i18n/`: locale list, an `en` catalog, an `es` demo catalog (machine-translated, marked as needing review), `getLocale()` from the `NEXT_LOCALE` cookie then `Accept-Language`, a server `t()`, a small client hook or provider, a language switcher, `<html lang>`. Translate only navigation, header and common strings; do not sweep every component (it would collide with the other branches). Missing keys fall back to English. Document the incremental extraction approach in `docs/i18n.md`.
  - **(b) Follows, design note only** at `docs/plans/research/phase-5-follows.md`: how account sync could read followed designers per platform, a proposed `SavedFollow` model, UI placement, risks. No scraper code (it cannot be tested without real accounts) and no write-back.
- **Done when:** switching language changes nav labels, persists via cookie and updates `<html lang>`; tsc, lint and build pass; design note committed.

## 5. Branches, merge order, conflict hotspots

| Phase | Branch |
|---|---|
| plan | `plan/three-drop-integration` |
| 0 | `feat/3drop-p0-adapter-tests` |
| 1 | `feat/3drop-p1-handoff-sort` |
| 2 | `feat/3drop-p2-new-platforms` |
| 3 | `feat/3drop-p3-collections` |
| 4 | `feat/3drop-p4-contests` |
| 5 | `feat/3drop-p5-i18n-follows` |

Recommended merge order: P0, P1, P3, P2, P4, P5.

Expected conflicts (all small):

- `src/types/model.ts`: P1 (`SortOption`) and P2 (`SourcePlatform`).
- `src/components/SidebarFilters.tsx`: P1 and P2.
- `src/lib/nav-items.ts`: P4 and P5.
- `package.json` / `package-lock.json`: P0 only.
- `prisma/schema.prisma`: P3 only.
- `CLAUDE.md`: any phase may add one line to Architecture Notes; keep it to a single line each.

## 6. Verification (every branch)

`npm ci`, `npx prisma generate`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (dummy env values are fine), plus `npm test` once Phase 0 is merged. Smoke-test each feature against a local dev server with a scratch SQLite database.

## 7. Open questions

- Which UI languages to ship beyond English (3Drop: EN, DE, ES, FR, JA, KO, ZH).
- True date sorting needs a creation date from each platform's search response; worth a follow-up once Phase 0 tests exist.
- CI: there is no workflow today. Add GitHub Actions (`lint`, `tsc`, `test`) after Phase 0 merges?
- Which of Maker Online and NextPrint matter to you.

## 8. Execution notes

Phases are implemented in parallel by separate agents, each in its own git worktree on its own branch cut from `plan/three-drop-integration`. Nothing is pushed and no pull requests are opened.

## 9. Status

All six branches are committed locally and unpushed. Each passed `tsc` and `lint`; P0 (273 tests), P1 and P2 were checked independently by the coordinator, P3, P4 and P5 were re-checked with `tsc` and `lint`.

| Phase | Branch | HEAD | Outcome |
|---|---|---|---|
| P0 | `feat/3drop-p0-adapter-tests` | b7b3e09 | Vitest + tsx, 273 tests, `npm run probe`, shared `resultKey` and saved-search diff |
| P1 | `feat/3drop-p1-handoff-sort` | 001a40e | Thangs/Creality hand-off links, honest Relevance sort |
| P2 | `feat/3drop-p2-new-platforms` | a823313 | Research only: Maker Online and Nexprint are hand-off only |
| P3 | `feat/3drop-p3-collections` | 6ac2376 | Favorite collections: schema, migration, API, UI |
| P4 | `feat/3drop-p4-contests` | 4112965 | `/contests` with static outbound links; no legitimate live source found |
| P5 | `feat/3drop-p5-i18n-follows` | f3869fb | Dependency-free i18n (en, es) plus follows design note |

Trial merge (order P0, P1, P3, P2, P4, P5): P0-P3 merge cleanly. P4 and P5 conflict with each other in `CLAUDE.md` (adjacent one-liners) and `src/lib/nav-items.ts` (P5 adds `labelKey`, P4 adds a Contests entry); resolve by keeping both.

Unverified: Creality search URL (robots.txt disallows `*/search`, never requested); live probe of keyed adapters; PostgreSQL migration run; signed-in UI paths.

Follow-ups: add Maker Online / Nexprint hand-off entries after P1 merges (key type wider than `SourcePlatform`); P0 found `platforms=''` yields zero adapters, repeated platform names are not deduplicated, and `/api/saved-searches/run` is unauthenticated and unthrottled.
