# Phase 4 research: is there a legitimate public source for contests?

Branch: `feat/3drop-p4-contests` - researched November 2026 (Wayback lookups repeated 2026-11-06).

Question: which platforms publish contests/challenges through a **legitimate public source**, meaning
(a) an official, documented API, or (b) an anonymous JSON/GraphQL endpoint the site itself serves without a bot
challenge and that robots.txt and the terms do not prohibit? Anything else is a hand-off link only
(`docs/plans/three-drop-integration.md` section 3).

## Verdict

**No platform passed the bar.** Every contest listing page that I requested answered an honest-UA `curl` with
Cloudflare's "Just a moment..." challenge (HTTP 403). I recorded that and stopped; I did not retry, change client or
spoof headers. Official APIs either need credentials this project does not have or do not document any contest
resource. Consequence for the build:

- `/contests` ships the `ContestSource` interface and the `getContests()` aggregator (`Promise.allSettled`, per-source
  failure reporting, past-deadline filtering), but the live-source registry is **empty**.
- The guaranteed fallback is a curated static table of outbound "Browse contests on X" links, using a listing URL only
  where I could verify it exists, otherwise the platform's site root.

## Method and rules followed

- Honest default user agent (`curl`), no cookies, no header spoofing, no headless browser against third-party sites.
- Per site: `robots.txt` once, the contest listing page once. A 403 challenge ended the investigation of that host.
- Terms of service read only where reachable; the project's own guardrails forbid evading blocks.
- No GraphQL introspection and no probing of undocumented endpoints.
- URL existence for challenged pages checked through the Internet Archive availability API
  (`https://archive.org/wayback/available?url=<url>&timestamp=<ts>`). A Wayback snapshot with status 200 proves only
  that the URL existed and what it looked like on that date. It is **not** a data source and is never fetched by the app.
- Web search was used to discover candidate URLs; search-only evidence is labelled "search-indexed only".

## Summary

| Platform | Listing URL (existence evidence) | Anonymous machine-readable source? | Fields on the human page | Verdict |
| --- | --- | --- | --- | --- |
| Printables | `https://www.printables.com/contest` (Wayback 200, 2026-09-26) | None documented. Undocumented GraphQL exists; terms prohibit automated extraction | title, start/end date+time (UTC), prizes, status, description | Hand-off link |
| MakerWorld | `https://makerworld.com/en/contests` (Wayback 200, 2026-09-23; child URL `/en/contests/164` confirmed by a Bambu staff post) | None. No public API; terms unreadable (under robots-disallowed `/policies`) | title, tagline, "Ends in N days", participant counts | Hand-off link |
| Thingiverse | `https://www.thingiverse.com/challenges` (Wayback 200, 2026-10-19) | API needs an app token; no documented challenge resource | title, summary, "Days Remaining", "CLOSES <date>", prize-winner count | Hand-off link |
| Cults3D | `https://cults3d.com/en/contests` (Wayback 200, 2026-09-15) | GraphQL API needs an account key; contests in the schema unverified | thumbnail per contest; themes/prizes on detail pages | Hand-off link |
| MyMiniFactory | `https://www.myminifactory.com/competitions` (search-indexed only; no Wayback snapshot) **unverified** | API v2 needs a key; no competitions resource found | not observed | Hand-off to site root |
| Creality Cloud | `https://www.crealitycloud.com/contest` (Wayback 200, 2026-07-22, title "Creality Cloud Contests") | None found; Cloudflare-protected per project notes | not observed | Hand-off link |
| GrabCAD | `https://grabcad.com/challenges` (Wayback availability answered status 202, inconclusive) **unverified** | none found | not observed | Hand-off to site root |
| Thangs | no listing URL verified (`/contests` has no Wayback snapshot) **unverified** | none found; Cloudflare-protected per project notes | not observed | Hand-off to site root |

## Per-platform evidence

### Printables (Prusa Research)

- `https://www.printables.com/robots.txt` (read, 200): `User-agent: *`, `Allow: /`, `Disallow: /world/`, sitemap. The
  contest path is allowed by robots.
- `https://api.printables.com/robots.txt`: HTTP 404 "Not Found" (no stated policy for the API host).
- `https://www.printables.com/contest`: **HTTP 403 Cloudflare managed challenge** to an honest-UA `curl`. Stopped.
- The existing search adapter calls the undocumented GraphQL endpoint `https://api.printables.com/graphql/`. I found
  no public documentation and no documented contests query, and did not introspect the schema.
- Terms: the Prusa General Terms and Conditions (effective 20 April 2026), Art. 9.1 / 9.3 / 9.5, as summarised by my
  fetch tool, prohibit unauthorised automated extraction of site contents including scraping, and burdening the
  service with tools or scripts. These are second-hand paraphrases (the tool cuts quotes short): a human should re-read
  Art. 9 before anyone builds on that endpoint. Note the same reading would apply to the existing search adapter,
  which is outside this phase.
- Human page fields (Wayback snapshot 2026-09-26, `id_` raw capture): contest title, "Starting"/"Ending" with a UTC
  time, an itemised prize list (printer, vouchers, Prusameters), an "Open" status badge, long description.
- Verdict: not green. Static link `https://www.printables.com/contest`.

### MakerWorld (Bambu Lab)

- `https://makerworld.com/robots.txt` points to `/en/robots.txt` (read): `User-agent: *`, `Allow: /`, `Disallow:`
  `/sign-up`, `/sign-in`, `/my`, `/policies` (and locale-prefixed variants). Contests are not disallowed.
- The terms live under `/policies`, which robots disallows, so I did **not** read them. Without them permission to
  automate is unknown, and the listing itself is challenged, so the question is moot.
- `https://makerworld.com/en/contests`: **HTTP 403 Cloudflare challenge**. Stopped.
- No official public API found; community requests for one on the Bambu forum have no official answer.
- Existence of per-contest URLs: Bambu staff announcement `https://forum.bambulab.com/t/259820` (created 2026-09-16)
  links `https://makerworld.com/en/contests/164?name=Make%20for%20Good:%20Accessibility%20Design%20Contest` and says
  entries are due "until Nov. 15 UTC".
- Human page fields (Wayback 2026-09-23): title, tagline, "Ends in N days" (relative only), participant avatars,
  counts, "Hosted By Creator" label.
- Verdict: not green. Static link `https://makerworld.com/en/contests`.

### Thingiverse (MakerBot / UltiMaker)

- `https://www.thingiverse.com/robots.txt`: **HTTP 403 challenge**, so even the robots policy is unreadable. Stopped.
- Official API requires an app token (which this project does not hold); I found no documented challenge/contest
  resource. The existing adapter is already token-gated for search.
- Human page fields (Wayback 2026-10-19): title, summary, "Days Remaining: N", "LIVE NOW: CLOSES <date>",
  "3 PRIZE WINNERS".
- Search-indexed challenge pages (`/challenges/<slug>`) showed passed 2026 deadlines still labelled "Enter Challenge".
- Verdict: not green. Static link `https://www.thingiverse.com/challenges`.

### Cults3D

- `https://cults3d.com/robots.txt`: **HTTP 403 challenge**. Stopped.
- Official GraphQL API (`https://cults3d.com/graphql`) is documented as requiring an account API key; none is
  configured here, and I could not verify that contests are part of the schema. I did not call it.
- Human page (Wayback 2026-09-15): intro text "...regularly organizing competitions...", "Some contests are already
  finished but visit frequently this page to take part in new 3D printing challenges", a thumbnail grid; themes and
  prizes are on per-contest pages that I did not open. There is a "Contest" entry in the site nav.
- Verdict: not green. Static link `https://cults3d.com/en/contests`.

### MyMiniFactory

- `https://www.myminifactory.com/robots.txt` (read, 200): `User-agent: *` / `Allow: /` with a Cloudflare managed
  content-signal block (`search=yes, ai-train=no, use=reference`) and a list of AI-training crawlers disallowed
  (including ClaudeBot, anthropic-ai, Claude-Web). The block explicitly reserves text-and-data-mining rights under
  Art. 4 of EU Directive 2019/790.
- `https://www.myminifactory.com/competitions`: **HTTP 403 challenge**. Stopped.
- API v2 requires a key; its guidelines page also answered 403 to my fetch tool. No evidence of a competitions resource.
- The `/competitions` URL is known only from web search results; the Wayback availability API returned no snapshot.
  So it is **unverified**, and the static table links to the site root `https://www.myminifactory.com/`.

### Other platforms

- **Creality Cloud**: `https://www.crealitycloud.com/contest` has a Wayback 200 snapshot (title "Creality Cloud
  Contests | Creality Cloud"). Cloudflare protection per `CLAUDE.md`, so no live source.
- **GrabCAD**: `https://grabcad.com/challenges` is search-indexed; the Wayback availability API returned a snapshot
  with status 202 (not a confirmed page). **Unverified**, links to the site root.
- **Thangs**: no contest listing URL verified (`https://thangs.com/contests` has no Wayback snapshot; a
  `thangs.com/resources/contest-rules` page exists in search results only). **Unverified**, links to the site root.
- **CGTrader**, **Instructables**, **Hackaday.io**: only web-search level checks (CGTrader `/challenges`, Instructables
  `/contest/`, Hackaday.io keyed API). They are not in the app's `SourcePlatform` list, so they are not added.

## Yellow candidates (documented, not implemented)

Two vendors run Discourse forums where contest announcements are posted, and Discourse serves anonymous `.json`:

- `https://forum.creality.com/c/ongoing-events/creality-cloud-event/112` (category 112, `.json` read, HTTP 200)
- `https://forum.bambulab.com/t/259820.json` (topic JSON read, HTTP 200)

Both `robots.txt` files (read) disallow `/admin/`, `/auth/`, `/search`, `/session`, `/my`, `/c/*.rss`, `/t/*/*.rss`
and API-key URLs, but not `.json` category/topic URLs. Why not implemented:

- The data is unstructured announcements. Topic JSON carries `title`, `created_at`, `image_url`, `slug`, views; the
  deadline and prize are only in prose. There is no status field.
- Creality category 112 (24 topics) mixes contests, awards and giveaways: 14 titles match contest/challenge/award. The
  newest topic is from 2026-05-24, so most of the feed would be ended contests.
- Extracting deadlines from prose or classifying by keyword would be exactly the kind of hack the project rules reject.
- The forum terms were not read.

If a maintainer wants it later, the safe shape is an "announcements" list showing title, post date and a link, with no
deadline or status claim. It is not part of this phase.

## Staleness findings (drive the page design)

- Thingiverse snapshot captured 2026-10-19 shows "Days Remaining: 5" next to "CLOSES OCTOBER 16th 2026": the
  relative label came from a cache, and it contradicts the absolute date next to it.
- MakerWorld lists only "Ends in N days" (relative), which is meaningless once the HTML is cached.
- The service worker serves non-API navigations network-first with a cache fallback, so offline users can get old HTML.

Design rules for `/contests`: show absolute dates only (never "N days left"), compute status at render time, drop
entries whose deadline has passed, print an "as of" timestamp, and keep the static links free of per-contest claims.

## Not verified / limits

- Terms of service: only Prusa's were read (second-hand through a summariser); MakerWorld's are behind a
  robots-disallowed path; Thingiverse, Cults3D, MyMiniFactory, GrabCAD and Thangs terms were not read.
- Every first-party listing page returned a challenge to me, so field lists above come from Wayback snapshots and
  web-search evidence, not from live responses. I do not claim these are complete.
- Whether Cults3D's GraphQL schema exposes contests, and whether MyMiniFactory API v2 has a competitions resource,
  needs an authenticated look by someone holding a key; I did not try.
- Official blog RSS feeds (for example vendor blogs) were not investigated.
