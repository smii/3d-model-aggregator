import type { UnifiedModelResult } from '@/types/model';
import { fetchJson } from './http';
import type { SearchAdapter, SearchOptions } from './types';

// MakerWorld has no public API; this is the JSON endpoint its own web client
// calls for search. If it starts rejecting server-side requests (403 from bot
// protection), this adapter must move to a Playwright-backed background worker
// instead of running in the request path.
const SEARCH_ENDPOINT = 'https://makerworld.com/api/v1/search-service/select/design2';

const BROWSER_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

interface MakerWorldHit {
  id: number;
  title: string;
  cover: string | null;
  designCreator: { name: string | null } | null;
  likeCount: number | null;
  downloadCount: number | null;
  tags: string[] | null;
  license: string | null;
}

interface MakerWorldSearchResponse {
  total: number;
  hits: MakerWorldHit[];
}

function toUnified(hit: MakerWorldHit): UnifiedModelResult {
  const thumbnailUrl = hit.cover ?? '';
  return {
    id: String(hit.id),
    title: hit.title,
    sourcePlatform: 'makerworld',
    author: hit.designCreator?.name ?? 'Unknown',
    thumbnailUrl,
    // coverLandscape/coverPortrait are crop variants of this same cover
    // photo, not a gallery of distinct images -- just the one.
    images: thumbnailUrl ? [thumbnailUrl] : [],
    externalUrl: `https://makerworld.com/en/models/${hit.id}`,
    likesCount: hit.likeCount ?? 0,
    downloadsCount: hit.downloadCount ?? 0,
    price: null, // no price field found on the search endpoint
    tags: hit.tags ?? [],
    license: hit.license ?? 'Unknown',
    isLikedLocally: false,
  };
}

export const makerworldAdapter: SearchAdapter = {
  platform: 'makerworld',

  async search({ query, page = 1, perPage = 20, signal }: SearchOptions) {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('keyword', query);
    url.searchParams.set('limit', String(perPage));
    url.searchParams.set('offset', String((page - 1) * perPage));
    url.searchParams.set('orderBy', 'hotScore');

    const data = await fetchJson<MakerWorldSearchResponse>(
      url.toString(),
      { headers: BROWSER_HEADERS },
      signal,
    );

    return data.hits.map(toUnified);
  },
};
