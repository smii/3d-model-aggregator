import type { UnifiedModelResult } from "@/types/model";

function resultKey(result: UnifiedModelResult): string {
  return `${result.sourcePlatform}:${result.id}`;
}

/**
 * Collapses each cluster of likely-duplicate results (per result.alsoFoundOn,
 * see src/lib/aggregator/dedupe.ts) down to a single representative -- the
 * one with the most likes -- for a "hide duplicates" view. Union-find over
 * the alsoFoundOn edges so a chain of matches (A~B, B~C) collapses to one
 * group even if A and C weren't directly flagged against each other.
 */
export function collapseDuplicates(
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

  return [...groups.values()].map(
    (group) => group.reduce((best, item) => (item.likesCount > best.likesCount ? item : best))
  );
}
