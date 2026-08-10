// MakerWorld has no public API, so this scraper drives the real site with
// Playwright. It listens for the JSON responses the likes page fetches from
// makerworld's internal design-service (rich metadata: author, like counts)
// and falls back to DOM card extraction when the payload shape has drifted.
import type { Page, Response } from "playwright";
import {
  assertLoggedIn,
  extractModelsByLink,
  gotoAndSettle,
  withBrowserContext,
} from "./browser";
import {
  requireAuth,
  type AccountCredentials,
  type AccountSyncAuth,
  type NormalizedLikedModel,
} from "./types";

const PLATFORM = "makerworld" as const;
const MODEL_LINK_PATTERN = /\/models\/(\d+)/;

// Pages listing the signed-in user's saved designs, each imported under its
// own collection name.
const SOURCE_PAGES = [
  { url: "https://makerworld.com/en/my/likes", collectionName: "MakerWorld Likes" },
  {
    url: "https://makerworld.com/en/my/favorites",
    collectionName: "MakerWorld Favorites",
  },
];

// Internal endpoints the likes/favorites pages call for their list data.
const LIST_API_PATTERN = /makerworld\.com\/api\/.*(like|favorite|collection|design)/i;

interface MakerWorldHit {
  id: number | string;
  title?: string;
  name?: string;
  cover?: string | null;
  designCreator?: { name?: string | null } | null;
  likeCount?: number | null;
}

/** Pull a list of design hits out of whatever envelope the API used. */
function extractHits(payload: unknown): MakerWorldHit[] {
  if (typeof payload !== "object" || payload === null) return [];
  const record = payload as Record<string, unknown>;
  const candidates = [record.hits, record.list, record.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is MakerWorldHit =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          ("title" in item || "name" in item)
      );
    }
    // One level of nesting ({ data: { hits: [...] } }) is common.
    if (typeof candidate === "object" && candidate !== null) {
      const nested = extractHits(candidate);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

function toNormalized(
  hit: MakerWorldHit,
  collectionName: string
): NormalizedLikedModel {
  const id = String(hit.id);
  return {
    externalId: id,
    title: hit.title ?? hit.name ?? "",
    externalUrl: `https://makerworld.com/en/models/${id}`,
    thumbnailUrl: hit.cover ?? null,
    author: hit.designCreator?.name ?? null,
    likesCount: hit.likeCount ?? 0,
    collectionName,
    sourcePlatform: PLATFORM,
  };
}

/**
 * Best-effort form login for when only credentials are supplied. MakerWorld
 * authenticates through the Bambu Lab account portal, which may interpose
 * CAPTCHA or 2FA — cookies are the reliable path.
 */
async function loginWithCredentials(
  page: Page,
  credentials: AccountCredentials
): Promise<void> {
  await page.goto("https://makerworld.com/en/login", {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const emailInput = page
    .locator("input[type='email'], input[name*='account' i], input[name*='email' i]")
    .first();
  await emailInput.fill(credentials.identifier, { timeout: 15_000 });
  const passwordInput = page.locator("input[type='password']").first();
  await passwordInput.fill(credentials.password, { timeout: 15_000 });
  await passwordInput.press("Enter");
  await page
    .waitForURL((url) => !/login|signin/i.test(url.pathname), { timeout: 30_000 })
    .catch(() => {
      throw new Error(
        "makerworld credential login did not complete (CAPTCHA/2FA?) — connect the account with session cookies instead"
      );
    });
}

export async function scrapeMakerworldLikes(
  auth: AccountSyncAuth
): Promise<NormalizedLikedModel[]> {
  requireAuth(auth, PLATFORM);

  return withBrowserContext(auth.cookies, async (context) => {
    const page = await context.newPage();
    if (!auth.cookies?.length && auth.credentials) {
      await loginWithCredentials(page, auth.credentials);
    }

    const byId = new Map<string, NormalizedLikedModel>();

    for (const source of SOURCE_PAGES) {
      const apiHits: MakerWorldHit[] = [];
      const onResponse = async (response: Response) => {
        if (!LIST_API_PATTERN.test(response.url())) return;
        const payload = await response.json().catch(() => null);
        apiHits.push(...extractHits(payload));
      };
      page.on("response", onResponse);

      try {
        await gotoAndSettle(page, source.url);
      } catch {
        // Favorites may not exist for every account/site version; the likes
        // page alone is still a successful sync.
        page.off("response", onResponse);
        continue;
      }
      page.off("response", onResponse);
      assertLoggedIn(page, PLATFORM);

      const models =
        apiHits.length > 0
          ? apiHits
              .map((hit) => toNormalized(hit, source.collectionName))
              .filter((model) => model.title !== "")
          : await extractModelsByLink(page, {
              linkPattern: MODEL_LINK_PATTERN,
              platform: PLATFORM,
              collectionName: source.collectionName,
            });

      for (const model of models) {
        // First-seen wins so a design in both likes and favorites keeps the
        // richer likes entry.
        if (!byId.has(model.externalId)) byId.set(model.externalId, model);
      }
    }

    if (byId.size === 0) {
      throw new Error(
        "No liked models found on MakerWorld — the session may be logged out, the list may be empty, or the page markup changed"
      );
    }
    return [...byId.values()];
  });
}
