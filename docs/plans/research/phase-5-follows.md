# Phase 5 design note: importing followed designers (follows)

Status: DESIGN ONLY. No code, no schema change, no scraper. Nothing here has been tested against a real account.

Goal: extend account sync so a signed-in user can also import the designers they follow on Thingiverse, Printables and MakerWorld, read-only, and browse them next to imported likes.

Verification legend: **[code]** read in this repo; **[checked]** confirmed from a public page during research; **[unverified]** not confirmed, must be checked before building (several third-party pages answered 403 to automated fetches and were deliberately not worked around; one research batch was cut off by a usage limit).

## 1. What exists today [code]

- `PlatformAccount.encryptedCookies` holds an AES-256-GCM JSON blob (`AccountSyncAuth`, `src/lib/crypto.ts`), one row per user and platform.
- `POST /api/sync/import-account` stores credentials; `POST /api/sync/run` creates a `SyncJob` and runs `runImportJob` in the background via `after()`; `GET /api/sync/status` is polled by `/sync`.
- Per-platform likes scrapers in `src/lib/scrapers/account-sync/`: Thingiverse (REST with app token, Playwright DOM fallback), Printables (undocumented GraphQL with `pauth` bearer, DOM fallback), MakerWorld (Playwright with response sniffing). Results are upserted into `SavedModel`.
- UI: `/sync` (connect and run), `/favorites/likes` (browse). Both are on the service-worker bypass list.

Follows should reuse all of this: same credentials, same job runner, same status polling.

## 2. Proposed data model (sketch, NOT applied)

```prisma
model SavedFollow {
  id          String   @id @default(cuid())
  userId      String
  platform    String   // same plain-string convention as SavedModel (no enums, SQLite)
  designerId  String   // platform-stable id or handle
  handle      String?
  displayName String
  avatarUrl   String?
  profileUrl  String
  modelCount  Int?     // optional, only if the list page exposes it
  syncedAt    DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, platform, designerId])
  @@index([userId, platform])
}
```

Only plain scalar columns, so it works on SQLite and PostgreSQL (plan guardrail 11). `User` needs a back-relation field when implemented. Mirror whatever `SavedModel` does at the time (check its current shape first; other phases may change it). Re-sync semantics: upsert, and optionally delete rows no longer returned for a platform after a fully successful run (decide to match the likes behaviour).

## 3. Job and API placement

- Add a job kind rather than a new pipeline: either a `kind`/`scope` field on `SyncJob` (`likes` | `follows`) or a second `SyncJob` per run. Needs a migration for both databases; keep it additive and nullable/defaulted.
- `ImportScraper` gets an optional `scrapeFollows(auth)` returning `{ designerId, handle?, displayName, avatarUrl?, profileUrl }[]`. Platforms without it are skipped and reported, as search does with `skipped`.
- `POST /api/sync/run` accepts an optional `scope` (default `likes`, so current clients are unchanged). `GET /api/sync/status` unchanged apart from reporting the scope.
- New read endpoint `GET /api/follows` (session required, scoped to `userId`), the same shape of auth check as the likes listing.

## 4. UI placement

- `/sync`: a second checkbox or button per connected platform, "Also import followed designers". No new top-level nav item.
- Browse: a "Following" tab on `/favorites/likes` (or `/favorites/follows`), designer cards linking out to the platform profile. Link-out only; no new-model feed in the first cut.
- Any new route that renders session data must be added to the `public/sw.js` bypass list and the CLAUDE.md note. If a sub-route of `/favorites/likes` is used, the existing prefix bypass already covers it; `/favorites/follows` would need an added line.
- Strings go through `t()` from the start (`docs/i18n.md`).

## 5. Security and privacy

- Read-only: no follow/unfollow, no write-back, ever (guardrail 6).
- Reuse the encrypted cookie store; never log cookies or tokens (guardrail 8).
- Follow lists are the user's personal data: scope every query by `userId`, return nothing for signed-out sessions, bypass the service worker.
- Deleting a `PlatformAccount` or `User` must cascade to `SavedFollow`.

## 6. Per-platform feasibility

| Platform | Likely approach | Status |
| --- | --- | --- |
| Printables | Authenticated GraphQL (`api.printables.com`) as the likes scraper does, or DOM of the following list | The GraphQL operation or page for "following" is **[unverified]**; the API is undocumented and no staff statement says it is supported |
| MakerWorld | Playwright against the logged-in following page, sniffing JSON responses as the likes scraper does | Page URL and JSON shape **[unverified]**; see robots.txt tension below |
| Thingiverse | REST with the app token if a "following" listing exists, else DOM | Whether the REST API exposes a list of who a user follows is **[unverified]**; an unofficial client's TODO lists only follow/unfollow (POST/DELETE) calls, none of which may be used |

## 7. Risks

1. **Terms of service.** Reported, not read verbatim: Thingiverse/MakerBot Terms of Use (last updated Jan 3 2023) prohibit scraping or mining data from the sites and harvesting information about other users; the Printables terms defer to Prusa's general terms, which are reported to forbid automated extraction; MakerWorld's agreement reportedly forbids automated access (that page returned 403). All of this is **[unverified]** wording and must be re-read in full before implementation. Follows are other users' public profile data, which makes the "other users" clause more relevant than for likes. Product decision needed from the owner.
2. **robots.txt.** Printables [checked]: allows everything except `/world/`. MakerWorld [checked, via a summarising fetch; re-verify with a plain request]: disallows sign-in/sign-up/policies and `/my` (also under one-segment prefixes). The existing MakerWorld likes scraper already requests `/en/my/likes` and `/en/my/favorites`, which sits in that disallowed area, so adding a following page under `/my` would extend an existing guardrail-3 problem. Thingiverse robots.txt returned 403 (**[unverified]**). Flag to the owner now, independent of follows.
3. **Fragility.** Undocumented GraphQL, DOM scraping and response sniffing break on front-end releases. Follows would double the maintenance surface for lower value than likes.
4. **Bot protection.** Same Cloudflare-style blocking that keeps Thangs and Creality Cloud out of search can apply to logged-in pages; do not circumvent it.
5. **Untestable here.** Needs real accounts on three platforms; CI and agents have none. Without fixtures, selectors and queries cannot be validated.
6. **Account risk.** Automated access with a user's session cookie can get that account flagged; the user bears it.

## 8. Verification before building

1. Re-read the three terms and three robots.txt files in a normal browser; record exact clauses and decide go/no-go with the owner.
2. With a throwaway account per platform, in a browser: find the following list URL, the network call that backs it, pagination, and what identifies a designer (stable id vs handle).
3. Confirm the Thingiverse REST API has (or lacks) a following listing.
4. Decide delete-on-resync semantics and whether to store counts.
5. Write recorded-fixture tests for the parsers (needs Phase 0 test infrastructure) so breakage is detected without live accounts.

## 9. Recommendation

Do not build until step 8.1 is settled, since the MakerWorld robots finding already needs an owner decision. If approved, start with whichever platform has a documented or stable list endpoint (probably Thingiverse, if the REST API exposes one), ship it behind the existing connect flow, and keep the other two optional per platform.

## 10. Open questions

- Is the follow list wanted for browsing only, or as input to a "new from followed designers" feed (which needs periodic re-sync and more scraping)?
- Should imported follows be visible on the unauthenticated local favorites surfaces? Proposed: no, keep them with imported likes behind sign-in.
- Which platforms are acceptable under their terms?
