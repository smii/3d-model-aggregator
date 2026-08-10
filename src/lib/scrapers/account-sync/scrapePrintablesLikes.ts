// Printables exposes the same GraphQL API its web client uses (see
// src/lib/aggregator/printables.ts). The likes query below tracks the web
// client and is undocumented, so any API failure — schema drift, auth
// rejection — falls back to Playwright DOM scraping of the likes page.
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

const PLATFORM = "printables" as const;
const COLLECTION_NAME = "Printables Likes";
const GRAPHQL_ENDPOINT = "https://api.printables.com/graphql/";
const MEDIA_BASE = "https://media.printables.com";
const LIKES_URL = "https://www.printables.com/@me/likes";
const MODEL_LINK_PATTERN = /\/model\/(\d+)/;
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

const LIKED_MODELS_QUERY = /* GraphQL */ `
  query MyLikedModels($limit: Int!, $offset: Int!) {
    me {
      likedModels(limit: $limit, offset: $offset) {
        items {
          id
          name
          slug
          likesCount
          image {
            filePath
          }
          user {
            publicUsername
          }
        }
      }
    }
  }
`;

interface PrintablesLikedItem {
  id: string;
  name: string;
  slug: string;
  likesCount: number | null;
  image: { filePath: string | null } | null;
  user: { publicUsername: string | null } | null;
}

interface PrintablesLikedResponse {
  data?: { me?: { likedModels?: { items: PrintablesLikedItem[] } | null } | null };
  errors?: { message: string }[];
}

function toNormalized(item: PrintablesLikedItem): NormalizedLikedModel {
  return {
    externalId: item.id,
    title: item.name,
    externalUrl: `https://www.printables.com/model/${item.id}-${item.slug}`,
    thumbnailUrl: item.image?.filePath
      ? `${MEDIA_BASE}/${item.image.filePath}`
      : null,
    author: item.user?.publicUsername ?? null,
    likesCount: item.likesCount ?? 0,
    collectionName: COLLECTION_NAME,
    sourcePlatform: PLATFORM,
  };
}

/** The web client sends the `pauth` cookie's JWT as a bearer token. */
function buildAuthHeaders(cookies: SessionCookie[]): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
  };
  const authCookie = cookies.find((cookie) => /^(pauth|auth)$/i.test(cookie.name));
  if (authCookie) {
    headers.Authorization = `Bearer ${authCookie.value}`;
  }
  return headers;
}

async function fetchLikesViaApi(
  cookies: SessionCookie[]
): Promise<NormalizedLikedModel[]> {
  const headers = buildAuthHeaders(cookies);
  const models: NormalizedLikedModel[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operationName: "MyLikedModels",
        query: LIKED_MODELS_QUERY,
        variables: { limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} from Printables API`);
    }

    const data = (await response.json()) as PrintablesLikedResponse;
    if (data.errors?.length) {
      throw new Error(data.errors.map((error) => error.message).join("; "));
    }
    const items = data.data?.me?.likedModels?.items;
    if (!items) {
      throw new Error("Printables API returned no likedModels — schema drift or expired session");
    }

    models.push(...items.map(toNormalized));
    if (items.length < PAGE_SIZE) break;
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

export async function scrapePrintablesLikes(
  auth: AccountSyncAuth
): Promise<NormalizedLikedModel[]> {
  requireAuth(auth, PLATFORM);
  if (!auth.cookies?.length) {
    throw new Error(
      "printables sync requires session cookies — credential login is not supported"
    );
  }

  let apiError: unknown;
  try {
    const models = await fetchLikesViaApi(auth.cookies);
    if (models.length > 0) return models;
  } catch (error) {
    apiError = error;
  }

  const models = await scrapeLikesViaDom(auth.cookies);
  if (models.length === 0) {
    const apiDetail =
      apiError instanceof Error ? ` (API attempt failed: ${apiError.message})` : "";
    throw new Error(
      `No liked models found on Printables — the session may be logged out, the list may be empty, or the page markup changed${apiDetail}`
    );
  }
  return models;
}
