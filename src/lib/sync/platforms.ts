// Client-safe platform constants and sync-status types. Keep this module free
// of server-only imports (playwright, prisma client instances) so UI
// components can use it; scraper.ts re-exports the constants for server code.
import type { SyncJobStatus } from "@/lib/db";

// Platforms that support authenticated collection import. Subset of
// SourcePlatform — cults3d and thangs are search-only for now.
export const SYNC_PLATFORMS = [
  "thingiverse",
  "printables",
  "makerworld",
] as const;

export type SyncPlatform = (typeof SYNC_PLATFORMS)[number];

export function isSyncPlatform(value: unknown): value is SyncPlatform {
  return (
    typeof value === "string" &&
    (SYNC_PLATFORMS as readonly string[]).includes(value)
  );
}

export const PLATFORM_LABELS: Record<SyncPlatform, string> = {
  thingiverse: "Thingiverse",
  printables: "Printables",
  makerworld: "MakerWorld",
};

// Default domain applied to session cookies pasted as a raw Cookie header
// string (which carries no domain information of its own).
export const PLATFORM_COOKIE_DOMAINS: Record<SyncPlatform, string> = {
  thingiverse: ".thingiverse.com",
  printables: ".printables.com",
  makerworld: ".makerworld.com",
};

export interface SyncJobSummary {
  id: string;
  status: SyncJobStatus;
  totalImported: number;
  error: string | null;
  finishedAt: string | null;
}

export interface PlatformSyncStatus {
  platform: SyncPlatform;
  connected: boolean;
  lastSyncedAt: string | null;
  latestJob: SyncJobSummary | null;
}

export function isJobActive(job: SyncJobSummary | null | undefined): boolean {
  return job?.status === "PENDING" || job?.status === "RUNNING";
}
