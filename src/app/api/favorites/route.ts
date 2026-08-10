import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isModelCategory, type ModelCategory } from '@/types/model';

// Local, installation-wide favorites database — deliberately unauthenticated.

export interface FavoriteItem {
  id: string;
  externalId: string;
  title: string;
  author: string;
  externalUrl: string;
  thumbnailUrl: string | null;
  sourcePlatform: string;
  likesCount: number;
  license: string | null;
  category: ModelCategory | null;
  createdAt: string;
}

// Prisma stores category as a plain String (SQLite has no enums); values are
// validated on write, so the cast back to ModelCategory on read is safe.
function toItem(favorite: {
  id: string;
  externalId: string;
  title: string;
  author: string;
  externalUrl: string;
  thumbnailUrl: string | null;
  sourcePlatform: string;
  likesCount: number;
  license: string | null;
  category: string | null;
  createdAt: Date;
}): FavoriteItem {
  return {
    id: favorite.id,
    externalId: favorite.externalId,
    title: favorite.title,
    author: favorite.author,
    externalUrl: favorite.externalUrl,
    thumbnailUrl: favorite.thumbnailUrl,
    sourcePlatform: favorite.sourcePlatform,
    likesCount: favorite.likesCount,
    license: favorite.license,
    category: favorite.category as ModelCategory | null,
    createdAt: favorite.createdAt.toISOString(),
  };
}

function parseCategory(value: unknown): ModelCategory | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && isModelCategory(value)) return value;
  return undefined; // invalid
}

export async function GET() {
  const favorites = await prisma.favoriteModel.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ favorites: favorites.map(toItem) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.externalId !== 'string' ||
    !body.externalId ||
    typeof body.title !== 'string' ||
    typeof body.externalUrl !== 'string' ||
    typeof body.sourcePlatform !== 'string' ||
    !body.sourcePlatform
  ) {
    return NextResponse.json(
      { error: 'Missing required fields: externalId, title, externalUrl, sourcePlatform.' },
      { status: 400 },
    );
  }

  const category = parseCategory(body.category);
  if (category === undefined) {
    return NextResponse.json({ error: 'Unknown category.' }, { status: 400 });
  }

  const data = {
    title: body.title,
    author: typeof body.author === 'string' ? body.author : 'Unknown',
    externalUrl: body.externalUrl,
    thumbnailUrl: typeof body.thumbnailUrl === 'string' && body.thumbnailUrl ? body.thumbnailUrl : null,
    likesCount: typeof body.likesCount === 'number' ? body.likesCount : 0,
    license: typeof body.license === 'string' && body.license ? body.license : null,
    category,
  };

  const favorite = await prisma.favoriteModel.upsert({
    where: {
      sourcePlatform_externalId: {
        sourcePlatform: body.sourcePlatform,
        externalId: body.externalId,
      },
    },
    create: {
      sourcePlatform: body.sourcePlatform,
      externalId: body.externalId,
      ...data,
    },
    update: data,
  });

  return NextResponse.json({ favorite: toItem(favorite) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || !body.id) {
    return NextResponse.json({ error: 'Missing favorite "id".' }, { status: 400 });
  }

  const category = parseCategory(body.category);
  if (category === undefined) {
    return NextResponse.json({ error: 'Unknown category.' }, { status: 400 });
  }

  const { count } = await prisma.favoriteModel.updateMany({
    where: { id: body.id },
    data: { category },
  });
  if (count === 0) {
    return NextResponse.json({ error: 'Favorite not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const sourcePlatform = searchParams.get('platform');
  const externalId = searchParams.get('externalId');

  const where = id
    ? { id }
    : sourcePlatform && externalId
      ? { sourcePlatform, externalId }
      : null;
  if (!where) {
    return NextResponse.json(
      { error: 'Provide either "id" or both "platform" and "externalId".' },
      { status: 400 },
    );
  }

  const { count } = await prisma.favoriteModel.deleteMany({ where });
  if (count === 0) {
    return NextResponse.json({ error: 'Favorite not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
