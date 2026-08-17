import { NextResponse } from 'next/server';
import { resolveSearchAdapters, searchAllPlatforms } from '@/lib/aggregator';
import { isModelCategory } from '@/types/model';

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

  const { adapters, skipped } = resolveSearchAdapters({
    platforms: searchParams.get('platforms'),
    category,
  });

  if (adapters.length === 0) {
    return NextResponse.json({ results: [], failures: [], skipped });
  }

  const { results, failures } = await searchAllPlatforms(
    { query, page, category, signal: request.signal },
    adapters,
  );

  return NextResponse.json({ results, failures, skipped });
}
