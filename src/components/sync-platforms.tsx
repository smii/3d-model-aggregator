"use client";

import { useState } from "react";
import { Link2, RefreshCw } from "lucide-react";
import {
  ConnectPlatformModal,
  SyncStatusLine,
} from "@/components/ConnectPlatformModal";
import { useSyncStatus } from "@/lib/sync/use-sync-status";
import {
  isJobActive,
  PLATFORM_LABELS,
  SYNC_PLATFORMS,
  type SyncPlatform,
} from "@/lib/sync/platforms";

const PLATFORM_DESCRIPTIONS: Record<SyncPlatform, string> = {
  thingiverse: "Import your likes and collections from Thingiverse.",
  printables: "Import your liked models and collections from Printables.",
  makerworld: "Import your liked models and collections from MakerWorld.",
};

export function SyncPlatforms() {
  const { statuses, error: statusError, refresh } = useSyncStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPlatform, setModalPlatform] = useState<SyncPlatform>();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const connected = statuses?.filter((status) => status.connected) ?? [];
  const anyActive =
    statuses?.some((status) => isJobActive(status.latestJob)) ?? false;

  function openModal(platform?: SyncPlatform) {
    setModalPlatform(platform);
    setModalOpen(true);
  }

  async function handleSyncAll() {
    if (connected.length === 0) return;
    setSyncing(true);
    setSyncError(null);
    // Kick off all platform syncs concurrently; each runs as its own
    // background job on the server.
    const results = await Promise.allSettled(
      connected.map(async ({ platform }) => {
        const res = await fetch("/api/sync/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        });
        // 409 = already syncing; the status poller picks that job up anyway.
        if (!res.ok && res.status !== 409) {
          const data: { error?: string } | null = await res
            .json()
            .catch(() => null);
          throw new Error(
            `${PLATFORM_LABELS[platform]}: ${
              data?.error ?? `request failed (${res.status})`
            }`
          );
        }
      })
    );
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failures.length > 0) {
      setSyncError(
        failures
          .map((failure) =>
            failure.reason instanceof Error
              ? failure.reason.message
              : String(failure.reason)
          )
          .join("; ")
      );
    }
    setSyncing(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSyncAll}
          disabled={syncing || anyActive || connected.length === 0}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={`size-4 ${syncing || anyActive ? "animate-spin" : ""}`}
          />
          Sync My Collections &amp; Likes
        </button>
        <button
          type="button"
          onClick={() => openModal()}
          className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-300"
        >
          <Link2 className="size-4" />
          Connect a platform
        </button>
        {statuses && connected.length === 0 && (
          <p className="text-sm text-zinc-500">
            Connect at least one platform to sync.
          </p>
        )}
      </div>

      {(syncError ?? statusError) && (
        <p className="text-sm text-red-400">{syncError ?? statusError}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {SYNC_PLATFORMS.map((platform) => {
          const status = statuses?.find((s) => s.platform === platform);
          return (
            <div
              key={platform}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <div>
                <h2 className="font-medium">{PLATFORM_LABELS[platform]}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {PLATFORM_DESCRIPTIONS[platform]}
                </p>
                <div className="mt-2">
                  {status ? (
                    <SyncStatusLine status={status} />
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <RefreshCw className="size-3.5" />
                      Loading status...
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openModal(platform)}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:text-indigo-300"
              >
                <Link2 className="size-4" />
                {status?.connected ? "Reconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>

      <ConnectPlatformModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        statuses={statuses}
        initialPlatform={modalPlatform}
        onJobStarted={refresh}
      />
    </div>
  );
}
