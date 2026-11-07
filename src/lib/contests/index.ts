import type { Contest, ContestFailure, ContestFeed, ContestSource } from './types';

export type {
  Contest,
  ContestFailure,
  ContestFeed,
  ContestSource,
  ContestStatus,
} from './types';
export type { ContestLink } from './static-links';
export { STATIC_CONTEST_LINKS } from './static-links';
export { CONTESTS_REVALIDATE_SECONDS, fetchContestJson } from './fetch';

/**
 * Live contest feeds. Empty on purpose: the Phase 4 research found no platform
 * that publishes contests through an official API or an anonymous endpoint
 * served without a bot challenge and permitted by its terms (every listing
 * page answered with a Cloudflare challenge; the official APIs are
 * credential-gated). Add a source here only after re-checking that, and
 * record the evidence in docs/plans/research/phase-4-contests.md.
 */
export const LIVE_SOURCES: ContestSource[] = [];

// Overall budget shared by all sources, so one hung platform cannot stall the page.
const SOURCES_BUDGET_MS = 15_000;

function httpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { protocol, href } = new URL(value);
    return protocol === 'https:' || protocol === 'http:' ? href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Last gate before third-party records are rendered: drop ended contests and
 * any whose deadline has passed at `now`, discard malformed urls and
 * deadlines, de-duplicate by url, and order soonest deadline first (contests
 * without a deadline last). Evaluated per request, so a cached source
 * response can never keep an expired contest on screen.
 */
export function selectOpenContests(contests: Contest[], now: Date): Contest[] {
  const seen = new Set<string>();
  const open: { contest: Contest; closesAt: number | null }[] = [];

  for (const raw of contests) {
    const url = httpUrl(raw.url);
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!url || !title || raw.status === 'ended' || seen.has(url)) continue;

    const parsed = raw.deadline ? Date.parse(raw.deadline) : Number.NaN;
    const closesAt = Number.isNaN(parsed) ? null : parsed;
    if (closesAt !== null && closesAt <= now.getTime()) continue;

    seen.add(url);
    open.push({
      contest: {
        ...raw,
        title,
        url,
        deadline: closesAt === null ? undefined : new Date(closesAt).toISOString(),
        imageUrl: httpUrl(raw.imageUrl),
      },
      closesAt,
    });
  }

  open.sort((a, b) => {
    if (a.closesAt === b.closesAt) return 0;
    if (a.closesAt === null) return 1;
    if (b.closesAt === null) return -1;
    return a.closesAt - b.closesAt;
  });

  return open.map(({ contest }) => contest);
}

/**
 * Query every live source concurrently. A source that errors or times out is
 * reported in `failures` without sinking the others (same contract as
 * searchAllPlatforms in src/lib/aggregator).
 */
export async function getContests(
  sources: ContestSource[] = LIVE_SOURCES,
  now: Date = new Date(),
): Promise<ContestFeed> {
  const signal = AbortSignal.timeout(SOURCES_BUDGET_MS);
  const settled = await Promise.allSettled(
    sources.map(async (source) => source.fetchContests(signal)),
  );

  const contests: Contest[] = [];
  const failures: ContestFailure[] = [];

  settled.forEach((outcome, index) => {
    const { platform } = sources[index];
    if (outcome.status === 'fulfilled') {
      contests.push(...outcome.value);
    } else {
      const error =
        outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
      console.error(`[contests] ${platform} fetch failed: ${error}`);
      failures.push({ platform, error });
    }
  });

  return {
    contests: selectOpenContests(contests, now),
    failures,
    sourceCount: sources.length,
    fetchedAt: now.toISOString(),
  };
}
