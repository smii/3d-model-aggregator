import { NextResponse } from 'next/server';

// Client-side 3D preview support. Thingiverse is the only platform wired up
// here: its file API resolves to a CDN URL that sends
// `access-control-allow-origin: *` (verified live), so the browser can load
// the mesh directly with three.js without the server proxying the binary.
// Cults3D's file URLs are null unless the file was purchased/owned, and
// MakerWorld/GrabCAD already reject plain server-side requests for search
// itself, so a files endpoint there is assumed to be gated the same way —
// not wired up.

const PREVIEWABLE_EXTENSIONS = new Set(['stl', '3mf']);

interface ThingiverseFile {
  name: string;
  direct_url: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');
  const externalId = searchParams.get('externalId');

  if (!externalId) {
    return NextResponse.json({ error: 'Missing "externalId".' }, { status: 400 });
  }

  if (platform !== 'thingiverse') {
    return NextResponse.json(
      { error: `Preview isn't available for "${platform}".` },
      { status: 400 },
    );
  }

  const token = process.env.THINGIVERSE_APP_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'THINGIVERSE_APP_TOKEN is not set' }, { status: 500 });
  }

  const response = await fetch(`https://api.thingiverse.com/things/${externalId}/files`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: `Thingiverse files lookup failed (${response.status}).` },
      { status: 502 },
    );
  }

  const files = (await response.json()) as ThingiverseFile[];
  const previewable = files.find((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return extension && PREVIEWABLE_EXTENSIONS.has(extension) && file.direct_url;
  });

  if (!previewable?.direct_url) {
    return NextResponse.json(
      { error: 'No STL/3MF file found for this model.' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    fileUrl: previewable.direct_url,
    fileName: previewable.name,
    format: previewable.name.split('.').pop()?.toLowerCase(),
  });
}
