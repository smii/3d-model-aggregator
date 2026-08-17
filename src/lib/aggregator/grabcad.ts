import type { ModelCategory, UnifiedModelResult } from '@/types/model';
import { fetchJson } from './http';
import type { SearchAdapter, SearchOptions } from './types';

// GrabCAD has no public API; this is the JSON endpoint its community library
// web client calls. It ignores per_page and always returns 24 results.
const SEARCH_ENDPOINT = 'https://grabcad.com/community/api/v1/models';

// GrabCAD library category slugs, verified against the endpoint (an unknown
// slug is silently ignored, so only send slugs from this list). GrabCAD is an
// engineering site and has no equivalent for art/fashion/miniatures.
const CATEGORY_SLUGS: Partial<Record<ModelCategory, string>> = {
  toys_games: 'toys',
  gadgets: 'tech',
  tools: 'tools',
  household: 'household',
  hobby_diy: 'hobby',
  learning: 'educational',
  sports_outdoor: 'sport',
};

// GrabCAD rejects requests with non-browser user agents.
const BROWSER_HEADERS = {
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

interface GrabCadModel {
  name: string;
  cached_slug: string;
  preview_image: string | null;
  likes_count: number | null;
  downloads_count: number | null;
  author: { name: string | null } | null;
}

interface GrabCadSearchResponse {
  total_entries: number;
  models: GrabCadModel[];
}

function toUnified(model: GrabCadModel): UnifiedModelResult {
  const thumbnailUrl = model.preview_image ?? '';
  return {
    id: model.cached_slug,
    title: model.name,
    sourcePlatform: 'grabcad',
    author: model.author?.name ?? 'Unknown',
    thumbnailUrl,
    images: thumbnailUrl ? [thumbnailUrl] : [],
    externalUrl: `https://grabcad.com/library/${model.cached_slug}`,
    likesCount: model.likes_count ?? 0,
    downloadsCount: model.downloads_count ?? 0,
    price: null, // GrabCAD is a free-only engineering library
    tags: [],
    license: 'Unknown',
    isLikedLocally: false,
  };
}

export const grabcadAdapter: SearchAdapter = {
  platform: 'grabcad',

  supportsCategory(category: ModelCategory) {
    return category in CATEGORY_SLUGS;
  },

  async search({ query, page = 1, category, signal }: SearchOptions) {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('query', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', 'popularity');
    const slug = category ? CATEGORY_SLUGS[category] : undefined;
    if (slug) {
      url.searchParams.set('categories', slug);
    }

    const data = await fetchJson<GrabCadSearchResponse>(
      url.toString(),
      { headers: BROWSER_HEADERS },
      signal,
    );

    return data.models.map(toUnified);
  },
};
