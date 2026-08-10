export type SourcePlatform =
  | 'makerworld'
  | 'printables'
  | 'thingiverse'
  | 'cults3d'
  | 'thangs'
  | 'crealitycloud'
  | 'grabcad'
  | 'myminifactory';

export type SortOption = 'newest' | 'most_liked';

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
  tags: string[];
  license: string;
  isLikedLocally: boolean;
}
