import type { UnifiedModelResult } from '@/types/model';

/**
 * Identity of a search result across the whole app: `"<platform>:<id>"`.
 * Platform ids are only unique within their own platform, so the platform is
 * part of the key. Used to drop duplicates when merging platform lists and to
 * diff saved-search runs. SavedSearch.lastSeenIds persists this exact format,
 * so changing it would make every saved search report its whole first page as
 * new on the next run.
 */
export function resultKey(
  result: Pick<UnifiedModelResult, 'sourcePlatform' | 'id'>,
): string {
  return `${result.sourcePlatform}:${result.id}`;
}
