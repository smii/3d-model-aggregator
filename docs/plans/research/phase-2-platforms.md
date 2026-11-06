# Phase 2 research: Maker Online and Nexprint

Researched 2026-11-06 on branch `feat/3drop-p2-new-platforms` for Phase 2 of
`docs/plans/three-drop-integration.md`. Decision rule: guardrail 3 (adapter only for an
official documented API, or a public anonymous JSON endpoint without a challenge, and only
if robots.txt and the terms allow it; otherwise hand-off link). Guardrails 1 and 2 also
applied: three-drop.com was not used as a source and nothing was done to get around a block.

## 1. Verdicts

| | Maker Online | Nexprint |
|---|---|---|
| Site | https://www.makeronline.com | https://www.nexprint.com |
| Operator | Anycubic (HONGKONG Anycubic Technology CO.,Ltd, named in its Terms) | Elegoo (its User Agreement names the "Nexprint Model Library") |
| Official public API | none found | none found |
| Anonymous JSON endpoint used by the site | internal, not identified, not probed | internal (`https://www.nexprint.com/gateway`), not probed |
| robots.txt | none (404) | allows `/en/search/works` (`Crawl-delay: 10`) |
| Terms on automated access | forbidden (Terms of User Agreement, section 6(7) and 6(8)) | forbidden (Elegoo User Agreement, sections 11.1(3), 11.2(8), 11.4) |
| Bot challenge for plain GETs | none seen (HTTP 200, behind Cloudflare) | none seen (HTTP 200, behind Cloudflare) |
| **Verdict** | **HAND-OFF** | **HAND-OFF** |

No adapter is built and no application code changes in this phase. The two hand-off entries
are in section 5; they go into `src/lib/handoff.ts` after Phase 1 merges (that file does not
exist on this branch).

"NextPrint" in the task is Nexprint (nexprint.com, by Elegoo). The 3Drop page is off-limits
(guardrail 1) and the one article about 3Drop I tried (Fabbaloo) returned HTTP 403 to the
fetch tool, so the identity is inferred, not confirmed against 3Drop's own list: the Elegoo
launch post (fetched, https://www.elegoo.com/blogs/news/elegoo-launches-nexprint-an-open-source-3d-model-platform-for-global-creators)
links to www.nexprint.com, and Elegoo's User Agreement names "Nexprint.com" as the Nexprint
Model Library site.

## 2. Method and limits

- Every request to the two sites used the honest User-Agent
  `3d-model-aggregator-research/0.1 (phase-2 platform research)`. No browser headers, no
  cookies sent, no proxies. No URL was requested twice and nothing was retried (the only
  non-2xx/3xx answers were the two robots.txt 404s on makeronline.com).
- 18 GET requests in total over a few minutes, sequential, no loops: 9 to makeronline.com,
  8 to nexprint.com, 1 to elegoo.com. Full list in section 6. A few nexprint.com requests
  were closer together than its declared `Crawl-delay: 10` (for example `/` and `/en` three
  seconds apart). They were one-off manual page loads, not a crawl, and nothing was fetched
  after the verdict was reached.
- Read: robots.txt, the public HTML pages (including the server-rendered state embedded in
  them), the Terms pages, and four public static JavaScript bundles (two per site, to read
  the search route and query parameter names the sites' own front ends use).
- Deliberately NOT requested: any internal JSON/API endpoint of either site (Makeronline's
  backend; Nexprint's `https://www.nexprint.com/gateway`). Both operators' terms forbid
  automated access, and an undocumented endpoint is exactly the "interface not provided by
  us" their terms exclude. So anything about "what the search API returns" is unverified.
- Web searches and one fetch of Elegoo's launch post were used only for orientation; claims
  below cite pages actually fetched, or say "unverified".
- All observations are from one network location (NL) and a handful of requests. Cloudflare
  behaviour under other IPs or higher volume is unverified.

## 3. Maker Online (makeronline.com)

**Official API, docs URL, auth: none found.**
Evidence: the navigation and footer of the pages fetched (`/en/` and `/en/policies/terms`)
list 3D Models, Contests, Forum, Store, AnyLab, Upload Models, "Import from a third-party
website", Privacy Policy, Terms of Service, Community Guidelines, Cookie Policy, About
Anycubic, Contact Us. There is no developer, API or open-platform entry. A web search for
makeronline.com API documentation found no page from the site. This cannot rule out a
private or partner API: unverified. The Terms (below) bar automated means "or interface not
provided by us", so an official interface would be the only allowed route, and none is
documented.

**Anonymous JSON endpoints the site uses: unverified (not probed).**
The home page (`https://www.makeronline.com/en/`, HTTP 200) is a Nuxt 2 server-rendered page
whose embedded state (`window.__NUXT__`) already carries model cards. The search page
(`https://www.makeronline.com/en/search/modelList?keyword=benchy&searchMethod=1`, HTTP 200)
embeds only the query state (`listQuery:{keyword:"benchy"}`, `searchMethod:"1"`) and no result
cards, so the results are loaded by the browser after hydration from a backend endpoint that
I did not identify or request (inference from the HTML, not from a network trace).

**robots.txt and terms stance: automated access is forbidden.**
- `https://makeronline.com/robots.txt` and `https://www.makeronline.com/robots.txt` both
  return HTTP 404 (text/plain). No robots directives exist either way.
- Terms of User Agreement, "Updated on March 31, 2026", https://www.makeronline.com/en/policies/terms,
  section 6 "Prohibited conduct":
  - 6(7): "Bypass any security or other features of the Site designed to control the manner in
    which the Site is used, harvest or mine User Content from the Site, or otherwise access
    or access the Site in a manner inconsistent with individual human usage"
  - 6(8): "Use any robot, spambot, spider, crawler, scraper or other automated means or
    interface not provided by us to access the Site or to extract data."
  - 5.1: use of the platform technology "without the prior explicit written consent of
    Makeronline is strictly prohibited."
- Under guardrail 3 this alone rules out an adapter.

**Bot challenge: none seen.**
Plain honest-UA GETs of `/en/`, and the two search URLs returned HTTP 200 with full HTML.
Served by Cloudflare (`server: cloudflare`, `cf-ray`, a `__cf_bm` cookie); no `cf-mitigated`
header and no `challenge-platform` script in the HTML. The 404 for robots.txt is also a
normal response, not a challenge. (Behaviour for API-style requests or at volume: unverified.)

**Native category support: unverified for search.**
The server-rendered cards carry `model_category_id`, `model_category1` and `model_category2`,
so the site has a category concept. Whether the search endpoint filters by category, and how
those categories map to `MODEL_CATEGORIES`, was not checked. If an adapter were ever built,
`supportsCategory` would have to stay false until that is verified.

**Fields in a search response: unverified (the search results were not requested).**
What the home-page cards expose in the server-rendered state (observed on `/en/`, not a
documented API): title (`title`), cover image (`mold_image`, one image), author (`user_name`,
`user_display_name`, `user_id`, `user_avatar`), likes (`like_num`), downloads (`download_num`),
license (`license`, a code whose mapping is unknown), a premium flag (`is_premium`), page link
(`target_url`), category ids, timestamps (`created_time`, `publish_time`), `is_adult_nsfw`,
contest names. No price amount field was seen, only the `is_premium` flag. Multiple images per
model: unverified.

**Verdict: HAND-OFF.** Search-page URL pattern (verified, section 5):
`https://www.makeronline.com/en/search/modelList?keyword=<encodeURIComponent(query)>&searchMethod=1`

How the pattern was derived and checked:
- The site's own header search code (public bundle
  `/_nuxt/components/layout-layout-header.ec6b1d2c.js`) navigates to
  `this.$i18n.path("/search/modelList")` with `query:{keyword, searchMethod}`; the search
  input bundle (`/_nuxt/components/search-input-keyword.43967712.js`) defaults
  `searchMethod` to `"1"`. `/en/` is the English locale prefix (the footer offers English and
  Simplified Chinese).
- Live: `keyword=benchy` and `keyword=articulated%20dragon` both returned HTTP 200 and the
  page state reflected the keyword (`listQuery:{keyword:"articulated dragon"}`). The page
  `<title>` is generic and does not contain the query.

## 4. Nexprint (nexprint.com)

**Official API, docs URL, auth: none found.**
Evidence: the Elegoo launch post (fetched) does not mention an API or developer access. The
Nexprint navigation and footer text (from `https://www.nexprint.com/en/terms`, HTTP 200)
lists 3D Models, Workshop, Events, Creator Fund, Account Closure Notice, Cookie Policy,
Privacy Agreement, UGC Rules, User Agreement, Feedback, Hall of Fame; no developer or API
entry. Web searches for a Nexprint API found no API documentation. Private or partner API:
unverified.

**Anonymous JSON endpoints the site uses: exists internally, not probed.**
The public entry bundle (`https://www.nexprint.com/_nuxt/entry-0_yuq2Ij.js`) sets its API
base to `https://www.nexprint.com/gateway` (plus `https://maker.nexprint.com` and
`https://account.elegoo.com`). That is the web app's private backend. It is not documented
as a public API, and I did not request it. Separately, the server-rendered search page
embeds the first page of results in its `__NUXT_DATA__` payload, but that is page HTML, and
reading it programmatically is scraping.

**robots.txt and terms stance: robots.txt allows, the terms forbid.**
- `https://www.nexprint.com/robots.txt` (HTTP 200): `User-agent: *`, `Allow: /`, then
  `Disallow` for `/account/*`, `/modelCompare/*`, `/articleMobile/*`, `/c/*`, `/elegooSlicer`
  (and `/*`), `/viedeoPreview` and the slicer login paths; `Crawl-delay: 10`; a sitemap line.
  `/en/search/works` is not disallowed.
- Elegoo User Agreement, "Effective Date: September 18, 2026, Last Updated: September 18,
  2026", https://www.elegoo.com/pages/elegoo-user-agreement. It states that it applies to
  "the Nexprint Model Library, Elegoo Matrix APP, ..." (preamble) and to the Nexprint site
  account system (section 10.3: "Nexprint Model Library website (Nexprint.com or
  Nexprint.cn)"). Relevant clauses:
  - 11.1(3): "Without the express written consent of ELEGOO, conducting any systematic or
    automated data collection activities (including but not limited to scraping, data mining,
    data extraction, data harvesting, AI training data scraping)"
  - 11.2(8): "Using crawlers, robots, scripts, AI training data scraping tools, or other
    automated means to access, scrape, copy, or monitor platform content (see Section 11. 4
    for details)"
  - 11.4 "Content Scraping Prohibition": "Without our prior written authorization, no user,
    third party, or AI service provider may use automated programs, crawlers, AI training
    data scraping tools, or other technical means to access, scrape, collect, copy, store,
    process, or use user content or data within the platform for machine learning, artificial
    intelligence model training, data mining, or other similar purposes. We reserve the right
    to pursue legal liability for violations of this provision."
- Clause 11.4 is aimed at AI training and data mining, but 11.1(3) and 11.2(8) are not
  limited to that. A server that fetches Nexprint on every user search is "automated means to
  access ... platform content", so the conservative reading is that it is not allowed.
  robots.txt permitting it does not override the terms; guardrail 3 requires both.
- Nexprint's own terms pages (`/en/terms`, with "UGC Rules" and "User Agreement" links) are
  rendered by JavaScript and their text is not in the fetched HTML ("No content available on
  this page"): unverified. The Elegoo User Agreement above is the text that names Nexprint.

**Bot challenge: none seen.**
`/en`, `/en/search/works?...`, `/en/terms` and `/robots.txt` all returned HTTP 200 to plain
honest-UA GETs. Served by Cloudflare (`server: cloudflare`, `__cf_bm` cookie). The HTML
includes `/cdn-cgi/challenge-platform/scripts/jsd/main.js`, which is how Cloudflare injects
its passive JavaScript detection (not read from Cloudflare docs this session); there was no
interstitial page and no `cf-mitigated` header. Behaviour for API-style requests or at
volume: unverified.

**Native category support: appears native on the website, mapping unverified.**
The search page bundle (`/_nuxt/works-DVwvNEaE.js`) reads `classificationId`, `filter`,
`sortType`, `timeFrame` (plus image-search parameters) from the URL query, and each result
object has a `classificationId` field (null on the 20 results observed). The classification
id values and their mapping to `MODEL_CATEGORIES` were not checked.

**Fields in a search response: observed in the page state only; the real API is unverified.**
In the server-rendered state of `https://www.nexprint.com/en/search/works?keyword=benchy`
(20 results, 52 keys per result; observed, not a documented API): title (`modelName`),
thumbnail (`coverImgUrl`, one image), author (`author` with `nickname`, `userId`,
`avatarUrl`; also `authorName`), `statistics` (`staticsModelDownloadCount`,
`staticsModelFavoriteCount`, `staticsModelStarPeoPleCount`, `staticsModelReadCount`,
`staticsModelPrintCount`, `staticsModelCommentCount`, ...), license (`licenseType`, integer
codes 0, 1, 6 and 7 seen, mapping unknown), tags (`modelTagList`), `publishTime`,
`lastUpdateTime`, `nsfw`, and reprint attribution (`originAuthor`, `originUrl`,
`originModelId`, `canReprint`). No price or cost key was present. Multiple images per model:
unverified.

**Dedupe note.** Elegoo's launch post (as extracted by the fetch tool) says Nexprint
"aggregates 3D models from platforms other than Nexprint", and the `origin*` fields above
look like that attribution. Any future integration would surface many duplicates of models
already returned by the existing adapters.

**Verdict: HAND-OFF.** Search-page URL pattern (verified, section 5):
`https://www.nexprint.com/en/search/works?keyword=<encodeURIComponent(query)>`

How the pattern was derived and checked:
- The public entry bundle's route table defines `search-works` at `/en/search/works` (also
  `/zh/` and `/de/`), and the page bundle reads `keyword` from the query.
- Live: `keyword=benchy` returned HTTP 200 with `{keyword: "benchy"}` in the page state;
  `keyword=articulated%20dragon` returned HTTP 200 with `<title>Search: articulated dragon -
  Nexprint</title>`.

## 5. Hand-off entries for `src/lib/handoff.ts` (add after Phase 1 merges)

Shape taken from the plan (platform, label, `searchUrl(query)`, `verified`); adapt the field
names to whatever `handoff.ts` looks like once Phase 1 lands. `verified: true` means each
pattern was loaded live with a single-word and an encoded multi-word query (HTTP 200, query
reflected by the page).

```ts
{
  platform: 'makeronline',
  label: 'Maker Online',
  searchUrl: (query: string) =>
    `https://www.makeronline.com/en/search/modelList?keyword=${encodeURIComponent(query)}&searchMethod=1`,
  verified: true,
},
{
  platform: 'nexprint',
  label: 'Nexprint',
  searchUrl: (query: string) =>
    `https://www.nexprint.com/en/search/works?keyword=${encodeURIComponent(query)}`,
  verified: true,
},
```

Typing note for the integrator: `platform` here should not force new members into
`SourcePlatform` (`src/types/model.ts`). Adding them would make the exhaustive
`platformBadges: Record<SourcePlatform, ...>` in `src/components/ModelCard.tsx` and the
`platformOptions` list in `src/components/SidebarFilters.tsx` need entries for platforms that
can never appear in results. Prefer a separate id type in `handoff.ts`
(for example `SourcePlatform | 'makeronline' | 'nexprint'`, or a plain string id). Hand-off
links make no server-side request to either site.

## 6. Request log

All GET, honest User-Agent, from one host, one request per URL. Paths starting with `/` are
on the site named in the first column.

| Site | URL | Status | Used for |
|---|---|---|---|
| makeronline.com | `https://makeronline.com/robots.txt` | 404 | robots.txt |
| makeronline.com | `https://www.makeronline.com/robots.txt` | 404 | robots.txt |
| makeronline.com | `https://www.makeronline.com/` | 302 to `/en/` | locale redirect |
| makeronline.com | `https://www.makeronline.com/en/` | 200 | nav/footer, card fields in page state |
| makeronline.com | `https://www.makeronline.com/en/policies/terms` | 200 | Terms of User Agreement |
| makeronline.com | `/_nuxt/components/layout-layout-header.ec6b1d2c.js` | 200 | header search route |
| makeronline.com | `/_nuxt/components/search-input-keyword.43967712.js` | 200 | `searchMethod` default |
| makeronline.com | `/en/search/modelList?keyword=benchy&searchMethod=1` | 200 | pattern check |
| makeronline.com | `/en/search/modelList?keyword=articulated%20dragon&searchMethod=1` | 200 | encoded multi-word check |
| nexprint.com | `https://www.nexprint.com/robots.txt` | 200 | robots.txt |
| nexprint.com | `https://www.nexprint.com/` | 302 to `/en` | locale redirect |
| nexprint.com | `https://www.nexprint.com/en` | 200 | home, Cloudflare/headers |
| nexprint.com | `/_nuxt/entry-0_yuq2Ij.js` | 200 | route table, API base |
| nexprint.com | `/_nuxt/works-DVwvNEaE.js` | 200 | search page query parameters |
| nexprint.com | `/en/search/works?keyword=benchy` | 200 | pattern check, result fields |
| nexprint.com | `/en/search/works?keyword=articulated%20dragon` | 200 | encoded multi-word check |
| nexprint.com | `/en/terms` | 200 | terms page (text is JS-rendered) |
| elegoo.com | `https://www.elegoo.com/pages/elegoo-user-agreement` | 200 | User Agreement text |

Other reads: Elegoo launch post (fetch tool, see section 1). Fabbaloo article about 3Drop:
HTTP 403 to the fetch tool, recorded and not retried or worked around.

## 7. Unverified, and what would change the verdicts

Unverified (not claimed anywhere above):
- The real search API of either platform: endpoints, auth, pagination, rate limits and the
  response fields for title, author, thumbnail, images, likes, downloads, license and price.
- Native category filtering and the mapping of either category scheme to `MODEL_CATEGORIES`.
- License code tables (`license` on Makeronline, `licenseType` on Nexprint).
- Nexprint's own `/en/terms`, UGC Rules and User Agreement pages (JavaScript-rendered), and
  Makeronline's Community Guidelines.
- Whether Anycubic or Elegoo offer a private or partner API.
- Cloudflare behaviour under higher volume, other IPs, or non-browser request shapes.

What would turn a HAND-OFF into an ADAPTER: written permission from the operator for
automated search access, or an officially documented API. Neither was found, and nobody has
been contacted. If that happens, re-run this research against the documented interface, send
an honest User-Agent (do not copy the browser-like `BROWSER_HEADERS` used by older adapters),
keep `supportsCategory` false until native category filtering is verified, and follow the
`SearchAdapter` contract from the plan.
