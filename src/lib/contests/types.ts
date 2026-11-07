import type { SourcePlatform } from '@/types/model';

/**
 * Lifecycle reported by the source. Ended contests are never shown; 'unknown'
 * is for sources that publish no status, where the deadline (if any) decides.
 */
export type ContestStatus = 'active' | 'upcoming' | 'ended' | 'unknown';

/** One contest/challenge as reported by a platform. */
export interface Contest {
  platform: SourcePlatform;
  title: string;
  /** The contest's own page on the platform (http/https only). */
  url: string;
  /**
   * When entries close, as an ISO 8601 timestamp. Always an absolute instant:
   * relative labels ("5 days left") go stale the moment HTML is cached.
   */
  deadline?: string;
  prize?: string;
  imageUrl?: string;
  status?: ContestStatus;
}

/**
 * A live contest feed for one platform. Only implement this for an endpoint
 * that is an official documented API, or an anonymous public JSON/GraphQL
 * endpoint served without a bot challenge and not prohibited by the
 * platform's robots.txt or terms. Everything else belongs in
 * static-links.ts as an outbound link. See docs/plans/research/phase-4-contests.md.
 */
export interface ContestSource {
  platform: SourcePlatform;
  /**
   * Must honour `signal` and use fetchContestJson (hourly revalidation,
   * timeout, honest User-Agent). A challenge or 403 is a failure to report,
   * never something to work around.
   */
  fetchContests(signal?: AbortSignal): Promise<Contest[]>;
}

export interface ContestFailure {
  platform: SourcePlatform;
  error: string;
}

export interface ContestFeed {
  /** Open contests only, soonest deadline first, contests without one last. */
  contests: Contest[];
  /** Sources that rejected; `contests` above excludes them. */
  failures: ContestFailure[];
  /** How many live sources were queried (0 while no endpoint is green-lit). */
  sourceCount: number;
  /** ISO timestamp of when this feed was assembled, shown as "as of". */
  fetchedAt: string;
}
