import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  // The only supported update today: mark as seen (reset the new-results
  // badge). Anything else in the body is ignored.
  if (body?.markSeen !== true) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { count } = await prisma.savedSearch.updateMany({
    where: { id },
    data: { newResultsCount: 0 },
  });
  if (count === 0) {
    return NextResponse.json({ error: 'Saved search not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { count } = await prisma.savedSearch.deleteMany({ where: { id } });
  if (count === 0) {
    return NextResponse.json({ error: 'Saved search not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
