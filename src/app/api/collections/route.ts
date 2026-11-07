import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCollectionName } from '@/lib/collection-names';
import {
  NAME_TAKEN_ERROR,
  collectionInclude,
  hasCollectionNameConflict,
  hasPrismaErrorCode,
  listCollections,
  toCollectionItem,
} from '@/lib/collections';

// Local, installation-wide favorite collections — deliberately unauthenticated,
// same convention as /api/favorites.

const nameTaken = () => NextResponse.json({ error: NAME_TAKEN_ERROR }, { status: 409 });

export async function GET() {
  return NextResponse.json({ collections: await listCollections() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseCollectionName(body?.name);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (await hasCollectionNameConflict(parsed.name)) return nameTaken();

  try {
    const collection = await prisma.favoriteCollection.create({
      data: { name: parsed.name },
      include: collectionInclude,
    });
    return NextResponse.json({ collection: toCollectionItem(collection) }, { status: 201 });
  } catch (error) {
    // Lost a race with an identical name created between the check and the insert.
    if (hasPrismaErrorCode(error, 'P2002')) return nameTaken();
    throw error;
  }
}
