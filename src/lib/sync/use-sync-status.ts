"use client";

import { useCallback, useEffect, useState } from "react";
import { isJobActive, type PlatformSyncStatus } from "@/lib/sync/platforms";

const ACTIVE_POLL_MS = 2000;

/**
 * Fetches /api/sync/status and keeps polling every ACTIVE_POLL_MS while any
 * import job is PENDING or RUNNING, so the UI can show live progress. Call
 * `refresh()` after starting a job to restart the polling loop immediately.
 */
export function useSyncStatus() {
  const [statuses, setStatuses] = useState<PlatformSyncStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollKey, setPollKey] = useState(0);

  const refresh = useCallback(() => setPollKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const res = await fetch("/api/sync/status", { cache: "no-store" });
        if (!res.ok) throw new Error(`Status request failed (${res.status})`);
        const data = (await res.json()) as { platforms: PlatformSyncStatus[] };
        if (cancelled) return;
        setStatuses(data.platforms);
        setError(null);
        if (data.platforms.some((platform) => isJobActive(platform.latestJob))) {
          timer = setTimeout(tick, ACTIVE_POLL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollKey]);

  return { statuses, error, refresh };
}
