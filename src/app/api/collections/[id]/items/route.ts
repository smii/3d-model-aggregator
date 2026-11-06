import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hasPrismaErrorCode } from '@/lib/collections';

// Membership of favorites in a collection. Local, installation-wide and
// deliberately unauthenticated, same convention as /api/favorites.

const collectionNotFound = () =>
  NextResponse.json({ error: 'Collection not found.' }, { status: 404 });
const favoriteNotFound = () =>
  NextResponse.json({ error: 'Favorite not found.' }, { status: 404 });
const missingFavoriteId = () =>
  NextResponse.json({ error: 'Missing "favoriteId".' }, { status: 400 });

// Add a favorite to the collection. Idempotent: 201 when it was added, 200
// when it was already in the collection.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const favoriteId: unknown = body?.favoriteId;
  if (typeof favoriteId !== 'string' || !favoriteId) return missingFavoriteId();

  const collection = await prisma.favoriteCollection.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!collection) return collectionNotFound();

  const favorite = await prisma.favoriteModel.findUnique({
    where: { id: favoriteId },
    select: { id: true },
  });
  if (!favorite) return favoriteNotFound();

  const alreadyMember = await prisma.favoriteCollectionItem.findUnique({
    where: { collectionId_favoriteId: { collectionId: id, favoriteId } },
    select: { collectionId: true },
  });
  if (alreadyMember) return NextResponse.json({ ok: true, added: false });

  try {
    await prisma.favoriteCollectionItem.create({
      data: { collectionId: id, favoriteId },
    });
  } catch (error) {
    // Raced with an identical request: the favorite is in the collection, which
    // is all the caller asked for.
    if (hasPrismaErrorCode(error, 'P2002')) {
      return NextResponse.json({ ok: true, added: false });
    }
    // The collection or favorite was deleted between the checks and the insert.
    if (hasPrismaErrorCode(error, 'P2003')) {
      return NextResponse.json(
        { error: 'Collection or favorite not found.' },
        { status: 404 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true, added: true }, { status: 201 });
}

// Remove a favorite from the collection (the favorite itself is kept). The id
// comes from `?favoriteId=` like the DELETE on /api/favorites; a JSON body is
// accepted as well.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let favoriteId: unknown = new URL(request.url).searchParams.get('favoriteId');
  if (!favoriteId) {
    const body = await request.json().catch(() => null);
    favoriteId = body?.favoriteId;
  }
  if (typeof favoriteId !== 'string' || !favoriteId) return missingFavoriteId();

  const collection = await prisma.favoriteCollection.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!collection) return collectionNotFound();

  const { count } = await prisma.favoriteCollectionItem.deleteMany({
    where: { collectionId: id, favoriteId },
  });
  if (count === 0) {
    return NextResponse.json(
      { error: 'Favorite is not in this collection.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
