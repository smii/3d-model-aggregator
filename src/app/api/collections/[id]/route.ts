import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parseCollectionName } from '@/lib/collection-names';
import {
  NAME_TAKEN_ERROR,
  collectionInclude,
  hasCollectionNameConflict,
  hasPrismaErrorCode,
  toCollectionItem,
} from '@/lib/collections';

// Local, installation-wide favorite collections — deliberately unauthenticated,
// same convention as /api/favorites.

const notFound = () =>
  NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
const nameTaken = () => NextResponse.json({ error: NAME_TAKEN_ERROR }, { status: 409 });

// Rename. The only editable field today is `name`; membership changes go
// through /api/collections/[id]/items.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = parseCollectionName(body?.name);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existing = await prisma.favoriteCollection.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return notFound();

  // Excluding the collection itself lets a rename change only the casing.
  if (await hasCollectionNameConflict(parsed.name, id)) return nameTaken();

  try {
    const collection = await prisma.favoriteCollection.update({
      where: { id },
      data: { name: parsed.name },
      include: collectionInclude,
    });
    return NextResponse.json({ collection: toCollectionItem(collection) });
  } catch (error) {
    // Lost a race: an identical name was taken, or the collection was deleted,
    // between the checks above and the update.
    if (hasPrismaErrorCode(error, 'P2002')) return nameTaken();
    if (hasPrismaErrorCode(error, 'P2025')) return notFound();
    throw error;
  }
}

// Deleting a collection cascades to its memberships only; the favorites in it
// are untouched.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { count } = await prisma.favoriteCollection.deleteMany({ where: { id } });
  if (count === 0) return notFound();
  return NextResponse.json({ ok: true });
}
