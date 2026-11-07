import { resultKey } from '@/lib/aggregator/result-key';
import type { UnifiedModelResult } from '@/types/model';

/** How many result keys a saved search remembers between runs. */
export const MAX_TRACKED_KEYS = 200;

export interface SavedSearchBaseline {
  /** Comma-separated "platform:id" keys stored by the previous run. */
  lastSeenIds: string;
  /** When the saved search last ran; null if it never has. */
  lastRunAt: Date | null;
}

export interface SavedSearchDiff {
  /** Results in this run whose key was not among the previous run's keys. */
  newCount: number;
  /** The value to store as the new lastSeenIds (at most MAX_TRACKED_KEYS keys). */
  lastSeenIds: string;
}

/**
 * Compare a saved search's fresh results with the keys it stored last time.
 *
 * - The first-ever run (lastRunAt null) only establishes the baseline, so it
 *   reports nothing as new.
 * - Every current result is compared, but only the first MAX_TRACKED_KEYS
 *   keys are remembered for next time.
 *
 * Pure: no database or clock access, so the caller decides what to persist.
 */
export function diffSavedSearchResults(
  results: ReadonlyArray<Pick<UnifiedModelResult, 'sourcePlatform' | 'id'>>,
  previous: SavedSearchBaseline,
): SavedSearchDiff {
  const currentKeys = results.map(resultKey);
  const previousKeys = new Set(previous.lastSeenIds.split(',').filter(Boolean));

  const newCount = previous.lastRunAt
    ? currentKeys.filter((key) => !previousKeys.has(key)).length
    : 0;

  return {
    newCount,
    lastSeenIds: currentKeys.slice(0, MAX_TRACKED_KEYS).join(','),
  };
}
