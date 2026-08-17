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
  externalUrl: string;
  likesCount: number;
  /**
   * Download count as reported by the source platform, 0 when the platform
   * doesn't expose one in its search response (Thingiverse only has it on
   * the per-item detail endpoint, not worth an N+1 call per result; MyMiniFactory
   * is unverified — its docs are behind bot protection).
   */
  downloadsCount: number;
  tags: string[];
  license: string;
  isLikedLocally: boolean;
}
