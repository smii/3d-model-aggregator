import type { ModelCategory, UnifiedModelResult } from '@/types/model';
import { fetchJson } from './http';
import type { SearchAdapter, SearchOptions } from './types';

// Printables exposes the same GraphQL API its web client uses. The schema is
// undocumented, so field names here track the current web client and may need
// updating if Printables changes them.
const GRAPHQL_ENDPOINT = 'https://api.printables.com/graphql/';
const MEDIA_BASE = 'https://media.printables.com';

// Printables category-tree node ids, discovered empirically against
// searchPrints2 (results are restricted to the given node's subtree).
const CATEGORY_IDS: Record<ModelCategory, number> = {
  toys_games: 30,
  art_design: 13,
  gadgets: 21,
  tools: 49,
  household: 3,
  hobby_diy: 48,
  fashion: 17,
  learning: 90,
  miniatures: 101,
  sports_outdoor: 9,
};

const SEARCH_QUERY = /* GraphQL */ `
  query SearchModels($query: String!, $limit: Int!, $offset: Int!, $categoryId: ID) {
    result: searchPrints2(query: $query, limit: $limit, offset: $offset, categoryId: $categoryId) {
      items {
        id
        name
        slug
        likesCount
        downloadCount
        image {
          filePath
        }
        images {
          filePath
        }
        user {
          publicUsername
        }
        license {
          name
        }
        tags {
          name
        }
      }
    }
  }
`;

interface PrintablesItem {
  id: string;
  name: string;
  slug: string;
  likesCount: number | null;
  downloadCount: number | null;
  image: { filePath: string | null } | null;
  images: { filePath: string | null }[] | null;
  user: { publicUsername: string | null } | null;
  license: { name: string | null } | null;
  tags: { name: string }[] | null;
}

interface PrintablesSearchResponse {
  data?: { result?: { items: PrintablesItem[] } };
  errors?: { message: string }[];
}

function toUnified(item: PrintablesItem): UnifiedModelResult {
  const primary = item.image?.filePath ?? null;
  const gallery = (item.images ?? [])
    .map((image) => image.filePath)
    .filter((path): path is string => Boolean(path));
  // Primary first, then the rest of the gallery minus any duplicate of it.
  const images = [primary, ...gallery.filter((path) => path !== primary)]
    .filter((path): path is string => Boolean(path))
    .map((path) => `${MEDIA_BASE}/${path}`);

  return {
    id: item.id,
    title: item.name,
    sourcePlatform: 'printables',
    author: item.user?.publicUsername ?? 'Unknown',
    thumbnailUrl: images[0] ?? '',
    images,
    externalUrl: `https://www.printables.com/model/${item.id}-${item.slug}`,
    likesCount: item.likesCount ?? 0,
    downloadsCount: item.downloadCount ?? 0,
    // Printables' API has a `price` field but it's null on every result
    // observed live (no paid listings surfaced through this search endpoint).
    price: null,
    tags: item.tags?.map((tag) => tag.name) ?? [],
    license: item.license?.name ?? 'Unknown',
    isLikedLocally: false,
  };
}

export const printablesAdapter: SearchAdapter = {
  platform: 'printables',

  supportsCategory(category: ModelCategory) {
    return category in CATEGORY_IDS;
  },

  async search({ query, page = 1, perPage = 20, category, signal }: SearchOptions) {
    const data = await fetchJson<PrintablesSearchResponse>(
      GRAPHQL_ENDPOINT,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationName: 'SearchModels',
          query: SEARCH_QUERY,
          variables: {
            query,
            limit: perPage,
            offset: (page - 1) * perPage,
            categoryId: category ? CATEGORY_IDS[category] : null,
          },
        }),
      },
      signal,
    );

    if (data.errors?.length) {
      throw new Error(data.errors.map((error) => error.message).join('; '));
    }

    return data.data?.result?.items.map(toUnified) ?? [];
  },
};
