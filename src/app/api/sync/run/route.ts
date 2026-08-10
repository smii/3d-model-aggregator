import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { runImportJob } from "@/lib/sync/import-runner";
import { isSyncPlatform, SYNC_PLATFORMS } from "@/lib/sync/platforms";

// Playwright needs the full Node.js runtime.
export const runtime = "nodejs";

/**
 * Re-syncs an already-connected platform using the stored encrypted cookies —
 * no cookie re-entry needed. Queues a SyncJob and runs it after the response
 * is sent, like /api/sync/import-account.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { platform?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isSyncPlatform(body.platform)) {
    return NextResponse.json(
      {
        error: `Unsupported platform. Expected one of: ${SYNC_PLATFORMS.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const platform = body.platform;

  const account = await prisma.platformAccount.findUnique({
    where: { userId_platformName: { userId, platformName: platform } },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Platform not connected. Connect the account first." },
      { status: 404 }
    );
  }

  // Refuse to queue a second concurrent import for the same platform; the
  // running job would race it on PlatformAccount cookies and SavedModel rows.
  const activeJob = await prisma.syncJob.findFirst({
    where: {
      userId,
      platformName: platform,
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
  if (activeJob) {
    return NextResponse.json(
      {
        error: "A sync for this platform is already in progress",
        jobId: activeJob.id,
      },
      { status: 409 }
    );
  }

  const job = await prisma.syncJob.create({
    data: { userId, platformName: platform, status: "PENDING" },
  });

  after(() => runImportJob(job.id));

  return NextResponse.json(
    { jobId: job.id, platform, status: job.status },
    { status: 202 }
  );
}
