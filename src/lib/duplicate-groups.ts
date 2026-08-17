import type { UnifiedModelResult } from "@/types/model";

const MAX_MERGED_IMAGES = 24;
const MAX_MERGED_TAGS = 20;

function resultKey(result: UnifiedModelResult): string {
  return `${result.sourcePlatform}:${result.id}`;
}

function mergeGroup(group: UnifiedModelResult[]): UnifiedModelResult {
  if (group.length === 1) return group[0];

  const byLikes = [...group].sort((a, b) => b.likesCount - a.likesCount);
  const primary = byLikes[0];

  const images = [...new Set(byLikes.flatMap((item) => item.images))].slice(
    0,
    MAX_MERGED_IMAGES
  );
  const tags = [...new Set(byLikes.flatMap((item) => item.tags))].slice(
    0,
    MAX_MERGED_TAGS
  );

  // If any copy is free, the model is available for free through that copy
  // -- a paid listing on one platform shouldn't hide a free one elsewhere,
  // and shouldn't make the merged card look paid when it doesn't have to be.
  const freeCopy = byLikes.find((item) => item.price === null);
  const price = freeCopy
    ? null
    : byLikes.reduce(
        (cheapest, item) =>
          item.price && (!cheapest || item.price.cents < cheapest.cents)
            ? item.price
            : cheapest,
        null as { cents: number; currency: string } | null
      );

  return {
    ...primary,
    images,
    tags,
    price,
    // Independent maxes, not just the primary's own numbers -- a copy
    // picked as primary for its likes might not be the one with the most
    // downloads, and sorting/display should reflect the model's real reach.
    likesCount: Math.max(...byLikes.map((item) => item.likesCount)),
    downloadsCount: Math.max(...byLikes.map((item) => item.downloadsCount)),
    isLikedLocally: byLikes.some((item) => item.isLikedLocally),
    alsoFoundOn: undefined,
    mergedPlatforms: byLikes.map((item) => ({
      platform: item.sourcePlatform,
      id: item.id,
      externalUrl: item.externalUrl,
      likesCount: item.likesCount,
      downloadsCount: item.downloadsCount,
      price: item.price,
    })),
  };
}

/**
 * Merges each cluster of likely-duplicate results (per result.alsoFoundOn,
 * see src/lib/aggregator/dedupe.ts) into a single card carrying the combined
 * image gallery, tags, and a list of every platform it's available on
 * (mergedPlatforms) -- rather than just picking one copy and dropping the
 * rest. Union-find over the alsoFoundOn edges so a chain of matches (A~B,
 * B~C) merges into one group even if A and C weren't directly flagged
 * against each other.
 */
export function mergeDuplicateGroups(
  results: ReadonlyArray<UnifiedModelResult>
): UnifiedModelResult[] {
  const byKey = new Map(results.map((result) => [resultKey(result), result]));
  const parent = new Map<string, string>();

  function find(key: string): string {
    let root = key;
    while (parent.get(root) && parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    parent.set(key, root);
    return root;
  }

  function union(a: string, b: string) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  }

  for (const result of results) {
    const key = resultKey(result);
    if (!parent.has(key)) parent.set(key, key);
    for (const match of result.alsoFoundOn ?? []) {
      const matchKey = `${match.platform}:${match.id}`;
      if (!byKey.has(matchKey)) continue; // matched result isn't in this set (filtered out)
      if (!parent.has(matchKey)) parent.set(matchKey, matchKey);
      union(key, matchKey);
    }
  }

  const groups = new Map<string, UnifiedModelResult[]>();
  for (const result of results) {
    const root = find(resultKey(result));
    const group = groups.get(root);
    if (group) {
      group.push(result);
    } else {
      groups.set(root, [result]);
    }
  }

  return [...groups.values()].map(mergeGroup);
}
