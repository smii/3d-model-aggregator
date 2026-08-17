import type { UnifiedModelResult } from '@/types/model';
import { fetchJson } from './http';
import type { SearchAdapter, SearchOptions } from './types';

const API_BASE = 'https://api.thingiverse.com';

interface ThingiverseHit {
  id: number;
  name: string;
  public_url: string | null;
  thumbnail: string | null;
  preview_image: string | null;
  like_count: number | null;
  creator: { name: string | null } | null;
  tags: { name: string }[] | null;
  license: string | null;
}

interface ThingiverseSearchResponse {
  total: number;
  hits: ThingiverseHit[];
}

function toUnified(hit: ThingiverseHit): UnifiedModelResult {
  return {
    id: String(hit.id),
    title: hit.name,
    sourcePlatform: 'thingiverse',
    author: hit.creator?.name ?? 'Unknown',
    thumbnailUrl: hit.thumbnail ?? hit.preview_image ?? '',
    externalUrl: hit.public_url ?? `https://www.thingiverse.com/thing:${hit.id}`,
    likesCount: hit.like_count ?? 0,
    // Thingiverse's search hits don't include download_count (only the
    // per-item detail endpoint does), and fetching that per result would
    // mean N extra requests per search. Left at 0.
    downloadsCount: 0,
    tags: hit.tags?.map((tag) => tag.name) ?? [],
    license: hit.license ?? 'Unknown',
    isLikedLocally: false,
  };
}

export const thingiverseAdapter: SearchAdapter = {
  platform: 'thingiverse',

  async search({ query, page = 1, perPage = 20, signal }: SearchOptions) {
    const token = process.env.THINGIVERSE_APP_TOKEN;
    if (!token) {
      throw new Error('THINGIVERSE_APP_TOKEN is not set');
    }

    const url = new URL(`${API_BASE}/search/${encodeURIComponent(query)}`);
    url.searchParams.set('type', 'things');
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));

    const data = await fetchJson<ThingiverseSearchResponse>(
      url.toString(),
      { headers: { Authorization: `Bearer ${token}` } },
      signal,
    );

    return data.hits.map(toUnified);
  },
};
