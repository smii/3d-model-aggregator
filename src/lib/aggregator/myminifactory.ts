import type { UnifiedModelResult } from '@/types/model';
import { fetchJson } from './http';
import type { SearchAdapter, SearchOptions } from './types';

// Official MyMiniFactory API (https://www.myminifactory.com/api-doc/).
// Requires an API key from https://www.myminifactory.com/settings/developer —
// anonymous requests get a 401.
const SEARCH_ENDPOINT = 'https://www.myminifactory.com/api/v2/search';

interface MmfImage {
  thumbnail?: { url: string | null } | null;
  small?: { url: string | null } | null;
  is_primary?: boolean;
}

interface MmfItem {
  id: number;
  name: string;
  url: string | null;
  images: MmfImage[] | null;
  designer: { username: string | null; name: string | null } | null;
  likes: number | null;
  tags: string[] | null;
}

interface MmfSearchResponse {
  total_count: number;
  items: MmfItem[];
}

function urlOf(image: MmfImage): string | null {
  return image.thumbnail?.url ?? image.small?.url ?? null;
}

function galleryOf(item: MmfItem): string[] {
  const images = item.images ?? [];
  const primaryIndex = images.findIndex((image) => image.is_primary);
  const ordered =
    primaryIndex > 0
      ? [images[primaryIndex], ...images.slice(0, primaryIndex), ...images.slice(primaryIndex + 1)]
      : images;
  return ordered.map(urlOf).filter((url): url is string => Boolean(url));
}

function toUnified(item: MmfItem): UnifiedModelResult {
  const images = galleryOf(item);
  return {
    id: String(item.id),
    title: item.name,
    sourcePlatform: 'myminifactory',
    author: item.designer?.name ?? item.designer?.username ?? 'Unknown',
    thumbnailUrl: images[0] ?? '',
    images,
    externalUrl: item.url ?? `https://www.myminifactory.com/object/3d-print-${item.id}`,
    likesCount: item.likes ?? 0,
    // MyMiniFactory's search API docs are behind bot protection and this
    // adapter has no API key configured to verify against live, so whether
    // a download count is available here is unconfirmed. Left at 0.
    downloadsCount: 0,
    // MyMiniFactory does have a paid marketplace, but there's no API key
    // configured to verify what field this would come from — left null.
    price: null,
    tags: item.tags ?? [],
    license: 'Unknown',
    isLikedLocally: false,
  };
}

export const myminifactoryAdapter: SearchAdapter = {
  platform: 'myminifactory',

  async search({ query, page = 1, perPage = 20, signal }: SearchOptions) {
    const key = process.env.MYMINIFACTORY_API_KEY;
    if (!key) {
      throw new Error('MYMINIFACTORY_API_KEY is not set');
    }

    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('key', key);

    const data = await fetchJson<MmfSearchResponse>(
      url.toString(),
      { headers: { Accept: 'application/json' } },
      signal,
    );

    return data.items.map(toUnified);
  },
};
