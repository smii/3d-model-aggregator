export type SourcePlatform =
  | 'makerworld'
  | 'printables'
  | 'thingiverse'
  | 'cults3d'
  | 'thangs'
  | 'crealitycloud'
  | 'grabcad'
  | 'myminifactory';

export type SortOption = 'newest' | 'most_liked' | 'most_downloaded';

export const MODEL_CATEGORIES = [
  'toys_games',
  'art_design',
  'gadgets',
  'tools',
  'household',
  'hobby_diy',
  'fashion',
  'learning',
  'miniatures',
  'sports_outdoor',
] as const;

export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

export function isModelCategory(value: string): value is ModelCategory {
  return (MODEL_CATEGORIES as readonly string[]).includes(value);
}

export interface UnifiedModelResult {
  id: string;
  title: string;
  sourcePlatform: SourcePlatform;
  author: string;
  thumbnailUrl: string;
  /**
   * The full image gallery when the platform's search response exposes one
   * (Printables, Cults3D, MyMiniFactory) -- always includes thumbnailUrl as
   * the first entry. Everywhere else this is just [thumbnailUrl]: MakerWorld
   * only offers crop variants of the same photo (not distinct images),
   * GrabCAD and Thingiverse only return a single image in search results.
   */
  images: string[];
  externalUrl: string;
  likesCount: number;
  /**
   * Download count as reported by the source platform, 0 when the platform
   * doesn't expose one in its search response (Thingiverse only has it on
   * the per-item detail endpoint, not worth an N+1 call per result; MyMiniFactory
   * is unverified — its docs are behind bot protection).
   */
  downloadsCount: number;
  /**
   * Price as reported by the source platform, null when free or when the
   * platform doesn't sell paid content at all. Only Cults3D populates this
   * (it's the only platform in this app with a real paid marketplace) —
   * Printables has a `price` field in its API but it's null on every result
   * observed, and the rest are free-only platforms.
   */
  price: { cents: number; currency: string } | null;
  tags: string[];
  license: string;
  isLikedLocally: boolean;
  /**
   * Other platforms carrying what looks like the same model, based on a
   * title-similarity heuristic (see src/lib/aggregator/dedupe.ts) — filled
   * in server-side after merging every platform's results, not by adapters.
   */
  alsoFoundOn?: { platform: SourcePlatform; id: string }[];
  /**
   * Present only on a client-side merged duplicate group (see
   * src/lib/duplicate-groups.ts, mergeDuplicateGroups) -- every platform
   * copy folded into this card, this result's own platform included, sorted
   * most-liked first. Lets the UI list every place the model is actually
   * available instead of just the one primary link.
   */
  mergedPlatforms?: {
    platform: SourcePlatform;
    id: string;
    externalUrl: string;
    likesCount: number;
    downloadsCount: number;
    price: { cents: number; currency: string } | null;
  }[];
}
