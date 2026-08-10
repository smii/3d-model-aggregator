import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import type { SyncPlatform } from "@/lib/sync/platforms";
import {
  scrapeAccountLikes,
  type AccountSyncAuth,
  type SessionCookie,
} from "@/lib/scrapers/account-sync";

/**
 * Executes a PENDING SyncJob: decrypts the platform session cookies, scrapes
 * the account's saved models with Playwright, and upserts them into
 * SavedModel. Designed to run detached from the request/response cycle (via
 * next/server `after`), so it never throws — all failures land on the job row
 * as status FAILED.
 */
export async function runImportJob(jobId: string): Promise<void> {
  const job = await prisma.syncJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PENDING") return;

  await prisma.syncJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const platformAccount = await prisma.platformAccount.findUnique({
      where: {
        userId_platformName: {
          userId: job.userId,
          platformName: job.platformName,
        },
      },
    });
    if (!platformAccount) {
      throw new Error(`No stored ${job.platformName} account for this user`);
    }

    // Accounts connected before credential support stored a bare cookie
    // array; newer ones store the full AccountSyncAuth object.
    const decrypted = JSON.parse(
      decryptSecret(platformAccount.encryptedCookies)
    ) as SessionCookie[] | AccountSyncAuth;
    const syncAuth: AccountSyncAuth = Array.isArray(decrypted)
      ? { cookies: decrypted }
      : decrypted;

    const models = await scrapeAccountLikes(
      job.platformName as SyncPlatform,
      syncAuth
    );

    // Sequential upserts: better-sqlite3 serializes writes anyway, and the
    // unique (userId, sourcePlatform, externalId) key makes re-syncs idempotent.
    let totalImported = 0;
    for (const model of models) {
      await prisma.savedModel.upsert({
        where: {
          userId_sourcePlatform_externalId: {
            userId: job.userId,
            sourcePlatform: job.platformName,
            externalId: model.externalId,
          },
        },
        create: {
          userId: job.userId,
          externalId: model.externalId,
          title: model.title,
          externalUrl: model.externalUrl,
          thumbnailUrl: model.thumbnailUrl,
          sourcePlatform: job.platformName,
          originalLikesCount: model.likesCount,
          collectionName: model.collectionName,
        },
        update: {
          title: model.title,
          externalUrl: model.externalUrl,
          thumbnailUrl: model.thumbnailUrl,
          originalLikesCount: model.likesCount,
          collectionName: model.collectionName,
        },
      });
      totalImported++;
      // Publish progress periodically so status polling can show a live count.
      if (totalImported % 5 === 0) {
        await prisma.syncJob.update({
          where: { id: jobId },
          data: { totalImported },
        });
      }
    }

    await prisma.$transaction([
      prisma.syncJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          totalImported,
          finishedAt: new Date(),
        },
      }),
      prisma.platformAccount.update({
        where: { id: platformAccount.id },
        data: { lastSyncedAt: new Date() },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sync] job ${jobId} (${job.platformName}) failed:`, error);
    await prisma.syncJob
      .update({
        where: { id: jobId },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      })
      .catch((updateError) =>
        console.error(`[sync] could not mark job ${jobId} failed:`, updateError)
      );
  }
}
