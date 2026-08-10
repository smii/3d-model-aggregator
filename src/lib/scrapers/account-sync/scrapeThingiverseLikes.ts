// Thingiverse is the one platform with a documented REST API, so likes are
// fetched from it when a profile username is known (public likes only, app
// token auth). Otherwise the scraper falls back to Playwright DOM parsing of
// the signed-in /likes page using the account's session cookies.
import {
  assertLoggedIn,
  extractModelsByLink,
  gotoAndSettle,
  withBrowserContext,
} from "./browser";
import {
  requireAuth,
  type AccountSyncAuth,
  type NormalizedLikedModel,
  type SessionCookie,
} from "./types";

const PLATFORM = "thingiverse" as const;
const COLLECTION_NAME = "Thingiverse Likes";
const API_BASE = "https://api.thingiverse.com";
const LIKES_URL = "https://www.thingiverse.com/likes";
const MODEL_LINK_PATTERN = /\/thing:(\d+)/;
const PAGE_SIZE = 30;
const MAX_PAGES = 40;

interface ThingiverseLike {
  id: number;
  name: string;
  public_url: string | null;
  thumbnail: string | null;
  preview_image: string | null;
  like_count: number | null;
  creator: { name: string | null } | null;
}

function toNormalized(like: ThingiverseLike): NormalizedLikedModel {
  return {
    externalId: String(like.id),
    title: like.name,
    externalUrl: like.public_url ?? `https://www.thingiverse.com/thing:${like.id}`,
    thumbnailUrl: like.thumbnail ?? like.preview_image ?? null,
    author: like.creator?.name ?? null,
    likesCount: like.like_count ?? 0,
    collectionName: COLLECTION_NAME,
    sourcePlatform: PLATFORM,
  };
}

async function fetchLikesViaApi(
  username: string,
  token: string
): Promise<NormalizedLikedModel[]> {
  const models: NormalizedLikedModel[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(
      `${API_BASE}/users/${encodeURIComponent(username)}/likes`
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(PAGE_SIZE));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText} from Thingiverse API`
      );
    }

    const likes = (await response.json()) as ThingiverseLike[];
    if (!Array.isArray(likes)) {
      throw new Error("Unexpected Thingiverse API response shape for likes");
    }

    models.push(...likes.map(toNormalized));
    if (likes.length < PAGE_SIZE) break;
  }

  return models;
}

async function scrapeLikesViaDom(
  cookies: SessionCookie[]
): Promise<NormalizedLikedModel[]> {
  return withBrowserContext(cookies, async (context) => {
    const page = await context.newPage();
    await gotoAndSettle(page, LIKES_URL);
    assertLoggedIn(page, PLATFORM);
    return extractModelsByLink(page, {
      linkPattern: MODEL_LINK_PATTERN,
      platform: PLATFORM,
      collectionName: COLLECTION_NAME,
    });
  });
}

export async function scrapeThingiverseLikes(
  auth: AccountSyncAuth
): Promise<NormalizedLikedModel[]> {
  requireAuth(auth, PLATFORM);

  const token = process.env.THINGIVERSE_APP_TOKEN;
  let apiError: unknown;
  if (auth.username && token) {
    try {
      const models = await fetchLikesViaApi(auth.username, token);
      if (models.length > 0) return models;
    } catch (error) {
      // Private profiles and renamed accounts 404 here; the cookie-based DOM
      // path below still works for those.
      apiError = error;
    }
  }

  if (!auth.cookies?.length) {
    const apiDetail =
      apiError instanceof Error ? ` (API attempt failed: ${apiError.message})` : "";
    throw new Error(
      `thingiverse sync needs session cookies, or a username plus THINGIVERSE_APP_TOKEN${apiDetail}`
    );
  }

  const models = await scrapeLikesViaDom(auth.cookies);
  if (models.length === 0) {
    throw new Error(
      "No liked models found on Thingiverse — the session may be logged out, the list may be empty, or the page markup changed"
    );
  }
  return models;
}
