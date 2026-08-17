import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isModelCategory } from '@/types/model';
import { MAX_CATEGORY_LENGTH } from '@/lib/category-constants';

// Local, installation-wide saved searches — deliberately unauthenticated,
// same convention as /api/favorites.

export interface SavedSearchItem {
  id: string;
  name: string;
  query: string;
  platforms: string[];
  category: string | null;
  sort: string;
  newResultsCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  createdAt: string;
}

function toItem(search: {
  id: string;
  name: string;
  query: string;
  platforms: string;
  category: string | null;
  sort: string;
  newResultsCount: number;
  lastRunAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}): SavedSearchItem {
  return {
    id: search.id,
    name: search.name,
    query: search.query,
    platforms: search.platforms ? search.platforms.split(',').filter(Boolean) : [],
    category: search.category,
    sort: search.sort,
    newResultsCount: search.newResultsCount,
    lastRunAt: search.lastRunAt?.toISOString() ?? null,
    lastError: search.lastError,
    createdAt: search.createdAt.toISOString(),
  };
}

export async function GET() {
  const searches = await prisma.savedSearch.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ savedSearches: searches.map(toItem) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    typeof body.query !== 'string' ||
    !body.query.trim()
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: name, query.' },
      { status: 400 },
    );
  }
  if (body.name.length > MAX_CATEGORY_LENGTH) {
    return NextResponse.json({ error: 'Name is too long.' }, { status: 400 });
  }

  let category: string | null = null;
  if (body.category !== null && body.category !== undefined) {
    if (typeof body.category !== 'string' || !isModelCategory(body.category)) {
      return NextResponse.json({ error: 'Unknown category.' }, { status: 400 });
    }
    category = body.category;
  }

  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p: unknown): p is string => typeof p === 'string')
    : [];

  const sort =
    typeof body.sort === 'string' && ['newest', 'most_liked', 'most_downloaded'].includes(body.sort)
      ? body.sort
      : 'newest';

  const search = await prisma.savedSearch.create({
    data: {
      name: body.name.trim(),
      query: body.query.trim(),
      platforms: platforms.join(','),
      category,
      sort,
    },
  });

  return NextResponse.json({ savedSearch: toItem(search) }, { status: 201 });
}
