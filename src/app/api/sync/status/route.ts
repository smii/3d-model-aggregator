import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma, type SyncJobStatus } from "@/lib/db";
import {
  SYNC_PLATFORMS,
  type PlatformSyncStatus,
} from "@/lib/sync/platforms";

/**
 * Reports, for every syncable platform, whether the signed-in user has
 * connected an account and the state of the most recent import job. Polled by
 * the UI while jobs are running to show live progress.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const [accounts, latestJobs] = await Promise.all([
    prisma.platformAccount.findMany({ where: { userId } }),
    Promise.all(
      SYNC_PLATFORMS.map((platform) =>
        prisma.syncJob.findFirst({
          where: { userId, platformName: platform },
          orderBy: { createdAt: "desc" },
        })
      )
    ),
  ]);

  const platforms: PlatformSyncStatus[] = SYNC_PLATFORMS.map(
    (platform, index) => {
      const account = accounts.find((a) => a.platformName === platform);
      const job = latestJobs[index];
      return {
        platform,
        connected: Boolean(account),
        lastSyncedAt: account?.lastSyncedAt?.toISOString() ?? null,
        latestJob: job
          ? {
              id: job.id,
              status: job.status as SyncJobStatus,
              totalImported: job.totalImported,
              error: job.error,
              finishedAt: job.finishedAt?.toISOString() ?? null,
            }
          : null,
      };
    }
  );

  return NextResponse.json({ platforms });
}
