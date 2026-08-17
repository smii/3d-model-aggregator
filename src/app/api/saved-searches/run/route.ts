import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveSearchAdapters, searchAllPlatforms } from '@/lib/aggregator';
import { isModelCategory, type UnifiedModelResult } from '@/types/model';

// Re-runs saved searches and flags results that weren't there last time.
// Hit periodically by a K8s CronJob (POST with no body -- see
// charts/3d-model-aggregator/chart/templates/cronjob.yaml) to run every due
// saved search, or on-demand with ?id=<id> for the "Run now" button. Local,
// unauthenticated, same convention as the rest of this app's install-wide
// data -- nothing here is user-specific.

const MAX_TRACKED_KEYS = 200;

function resultKey(result: UnifiedModelResult): string {
  return `${result.sourcePlatform}:${result.id}`;
}

async function runOne(search: {
  id: string;
  query: string;
  platforms: string;
  category: string | null;
  lastSeenIds: string;
  lastRunAt: Date | null;
}) {
  const category =
    search.category && isModelCategory(search.category) ? search.category : undefined;
  const { adapters } = resolveSearchAdapters({ platforms: search.platforms, category });

  if (adapters.length === 0) {
    await prisma.savedSearch.update({
      where: { id: search.id },
      data: { lastRunAt: new Date(), lastError: 'No platforms support this search.' },
    });
    return;
  }

  try {
    const { results, failures } = await searchAllPlatforms(
      { query: search.query, page: 1, category },
      adapters,
    );
    const currentKeys = results.map(resultKey);
    const previousKeys = new Set(
      search.lastSeenIds.split(',').filter(Boolean),
    );

    // A first-ever run just establishes the baseline -- nothing "new" yet.
    const newCount = search.lastRunAt
      ? currentKeys.filter((key) => !previousKeys.has(key)).length
      : 0;

    await prisma.savedSearch.update({
      where: { id: search.id },
      data: {
        lastRunAt: new Date(),
        lastSeenIds: currentKeys.slice(0, MAX_TRACKED_KEYS).join(','),
        newResultsCount: { increment: newCount },
        lastError: failures.length > 0
          ? `${failures.length} platform(s) failed: ${failures.map((f) => f.platform).join(', ')}`
          : null,
      },
    });
  } catch (error) {
    await prisma.savedSearch.update({
      where: { id: search.id },
      data: {
        lastRunAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const searches = await prisma.savedSearch.findMany(
    id ? { where: { id } } : undefined,
  );
  if (id && searches.length === 0) {
    return NextResponse.json({ error: 'Saved search not found.' }, { status: 404 });
  }

  // Sequential, not Promise.all: each run already fans out to every platform
  // concurrently internally, and running many saved searches in parallel on
  // top of that risks tripping the same platforms' rate limits/bot defenses
  // that the adapters already work around carefully.
  for (const search of searches) {
    await runOne(search);
  }

  return NextResponse.json({ ran: searches.length });
}
