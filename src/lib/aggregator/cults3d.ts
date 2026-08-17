import type { UnifiedModelResult } from '@/types/model';
import { fetchJson } from './http';
import type { SearchAdapter, SearchOptions } from './types';

// Official Cults3D GraphQL API (https://cults3d.com/en/pages/graphql).
// Requires HTTP Basic auth with a personal API key from
// https://cults3d.com/en/api/keys — anonymous requests are rejected.
const GRAPHQL_ENDPOINT = 'https://cults3d.com/graphql';

const SEARCH_QUERY = /* GraphQL */ `
  query SearchCreations($query: String!, $limit: Int!, $offset: Int!) {
    creationsSearchBatch(query: $query, limit: $limit, offset: $offset) {
      results {
        name(locale: EN)
        shortUrl
        illustrationImageUrl
        likesCount
        downloadsCount
        creator {
          nick
        }
      }
    }
  }
`;

interface Cults3dCreation {
  name: string;
  shortUrl: string;
  illustrationImageUrl: string | null;
  likesCount: number | null;
  downloadsCount: number | null;
  creator: { nick: string | null } | null;
}

interface Cults3dSearchResponse {
  data?: { creationsSearchBatch?: { results: Cults3dCreation[] } };
  errors?: { message: string }[];
}

function toUnified(creation: Cults3dCreation): UnifiedModelResult {
  return {
    id: creation.shortUrl,
    title: creation.name,
    sourcePlatform: 'cults3d',
    author: creation.creator?.nick ?? 'Unknown',
    thumbnailUrl: creation.illustrationImageUrl ?? '',
    externalUrl: creation.shortUrl,
    likesCount: creation.likesCount ?? 0,
    downloadsCount: creation.downloadsCount ?? 0,
    tags: [],
    license: 'Unknown',
    isLikedLocally: false,
  };
}

export const cults3dAdapter: SearchAdapter = {
  platform: 'cults3d',

  async search({ query, page = 1, perPage = 20, signal }: SearchOptions) {
    const username = process.env.CULTS3D_USERNAME;
    const apiKey = process.env.CULTS3D_API_KEY;
    if (!username || !apiKey) {
      throw new Error('CULTS3D_USERNAME / CULTS3D_API_KEY are not set');
    }

    const auth = Buffer.from(`${username}:${apiKey}`).toString('base64');
    const data = await fetchJson<Cults3dSearchResponse>(
      GRAPHQL_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          query: SEARCH_QUERY,
          variables: { query, limit: perPage, offset: (page - 1) * perPage },
        }),
      },
      signal,
    );

    if (data.errors?.length) {
      throw new Error(data.errors.map((error) => error.message).join('; '));
    }

    return data.data?.creationsSearchBatch?.results.map(toUnified) ?? [];
  },
};
