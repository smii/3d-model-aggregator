import { NextResponse } from 'next/server';
import {
  cults3dAdapter,
  grabcadAdapter,
  makerworldAdapter,
  myminifactoryAdapter,
  printablesAdapter,
  searchAllPlatforms,
  thingiverseAdapter,
  type SearchAdapter,
} from '@/lib/aggregator';
import { isModelCategory, type SourcePlatform } from '@/types/model';

// Thangs and Creality Cloud are absent: both gate search behind Cloudflare
// bot challenges that block server-side requests (and headless browsers).
const ADAPTERS_BY_PLATFORM: Partial<Record<SourcePlatform, SearchAdapter>> = {
  thingiverse: thingiverseAdapter,
  makerworld: makerworldAdapter,
  printables: printablesAdapter,
  cults3d: cults3dAdapter,
  grabcad: grabcadAdapter,
  myminifactory: myminifactoryAdapter,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q')?.trim() ?? '';
  if (!query) {
    return NextResponse.json(
      { error: 'Missing required query parameter "q".' },
      { status: 400 },
    );
  }

  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const rawCategory = searchParams.get('category');
  const category =
    rawCategory && isModelCategory(rawCategory) ? rawCategory : undefined;

  // Platforms without an adapter yet are silently skipped so the default
  // "all platforms" selection in the UI doesn't produce noise.
  const requested = searchParams.get('platforms')?.split(',').filter(Boolean);
  let adapters = requested
    ? requested
        .map((platform) => ADAPTERS_BY_PLATFORM[platform as SourcePlatform])
        .filter((adapter): adapter is SearchAdapter => adapter !== undefined)
    : Object.values(ADAPTERS_BY_PLATFORM);

  // Platforms that cannot filter by the requested category natively are
  // excluded (and reported) rather than allowed to return unfiltered matches.
  let skipped: SourcePlatform[] = [];
  if (category) {
    skipped = adapters
      .filter((adapter) => !adapter.supportsCategory?.(category))
      .map((adapter) => adapter.platform);
    adapters = adapters.filter((adapter) => adapter.supportsCategory?.(category));
  }

  if (adapters.length === 0) {
    return NextResponse.json({ results: [], failures: [], skipped });
  }

  const { results, failures } = await searchAllPlatforms(
    { query, page, category, signal: request.signal },
    adapters,
  );

  return NextResponse.json({ results, failures, skipped });
}
