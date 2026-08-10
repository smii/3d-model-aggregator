import type { UnifiedModelResult } from '@/types/model';
import { cults3dAdapter } from './cults3d';
import { grabcadAdapter } from './grabcad';
import { makerworldAdapter } from './makerworld';
import { myminifactoryAdapter } from './myminifactory';
import { printablesAdapter } from './printables';
import { thingiverseAdapter } from './thingiverse';
import type {
  AdapterFailure,
  AggregatedSearchResult,
  SearchAdapter,
  SearchOptions,
} from './types';

export type {
  AdapterFailure,
  AggregatedSearchResult,
  SearchAdapter,
  SearchOptions,
} from './types';
export { cults3dAdapter } from './cults3d';
export { grabcadAdapter } from './grabcad';
export { makerworldAdapter } from './makerworld';
export { myminifactoryAdapter } from './myminifactory';
export { printablesAdapter } from './printables';
export { thingiverseAdapter } from './thingiverse';

const DEFAULT_ADAPTERS: SearchAdapter[] = [
  thingiverseAdapter,
  makerworldAdapter,
  printablesAdapter,
  cults3dAdapter,
  grabcadAdapter,
  myminifactoryAdapter,
];

function resultKey(result: UnifiedModelResult): string {
  return `${result.sourcePlatform}:${result.id}`;
}

/**
 * Interleave per-platform result lists round-robin so the merged set is not
 * dominated by whichever platform returned the most (or fastest) results,
 * dropping duplicates by platform-scoped id.
 */
function mergeResults(perPlatform: UnifiedModelResult[][]): UnifiedModelResult[] {
  const merged: UnifiedModelResult[] = [];
  const seen = new Set<string>();
  const longest = Math.max(0, ...perPlatform.map((list) => list.length));

  for (let i = 0; i < longest; i++) {
    for (const list of perPlatform) {
      const result = list[i];
      if (result && !seen.has(resultKey(result))) {
        seen.add(resultKey(result));
        merged.push(result);
      }
    }
  }

  return merged;
}

/**
 * Fan a search out to every platform adapter concurrently. A platform that
 * errors or times out is reported in `failures` without sinking the results
 * from the platforms that succeeded.
 */
export async function searchAllPlatforms(
  options: SearchOptions,
  adapters: SearchAdapter[] = DEFAULT_ADAPTERS,
): Promise<AggregatedSearchResult> {
  const settled = await Promise.allSettled(
    adapters.map((adapter) => adapter.search(options)),
  );

  const perPlatform: UnifiedModelResult[][] = [];
  const failures: AdapterFailure[] = [];

  settled.forEach((outcome, index) => {
    const { platform } = adapters[index];
    if (outcome.status === 'fulfilled') {
      perPlatform.push(outcome.value);
    } else {
      const error =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      console.error(`[aggregator] ${platform} search failed: ${error}`);
      failures.push({ platform, error });
    }
  });

  return { results: mergeResults(perPlatform), failures };
}
