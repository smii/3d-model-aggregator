"use client";

import { useEffect, useState } from "react";
import { Check, CheckCircle2, Link2, Loader2, X, XCircle } from "lucide-react";
import {
  isJobActive,
  PLATFORM_LABELS,
  SYNC_PLATFORMS,
  type PlatformSyncStatus,
  type SyncPlatform,
} from "@/lib/sync/platforms";

/**
 * One-line sync state for a platform, e.g. "Syncing MakerWorld... 24 models
 * found". Shared by the modal and the sync page cards.
 */
export function SyncStatusLine({ status }: { status: PlatformSyncStatus }) {
  const label = PLATFORM_LABELS[status.platform];
  const job = status.latestJob;

  if (!status.connected && !job) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Link2 className="size-3.5" />
        Not connected
      </p>
    );
  }
  if (!job) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Check className="size-3.5 text-emerald-400" />
        Connected — never synced
      </p>
    );
  }

  switch (job.status) {
    case "PENDING":
      return (
        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="size-3.5 animate-spin text-indigo-400" />
          {`Waiting to sync ${label}...`}
        </p>
      );
    case "RUNNING":
      return (
        <p className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 className="size-3.5 animate-spin text-indigo-400" />
          {`Syncing ${label}...${
            job.totalImported > 0 ? ` ${job.totalImported} models found` : ""
          }`}
        </p>
      );
    case "COMPLETED":
      return (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          {`${label} synced — ${job.totalImported} models imported`}
        </p>
      );
    case "FAILED":
      return (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <XCircle className="size-3.5 shrink-0" />
          {`${label} sync failed${job.error ? `: ${job.error}` : ""}`}
        </p>
      );
  }
}

interface ConnectPlatformModalProps {
  open: boolean;
  onClose: () => void;
  /** Current per-platform status from useSyncStatus (null while loading). */
  statuses: PlatformSyncStatus[] | null;
  /** Platform to preselect when the modal opens. */
  initialPlatform?: SyncPlatform;
  /** Called after a connect request is accepted so the owner restarts polling. */
  onJobStarted: () => void;
}

export function ConnectPlatformModal({
  open,
  onClose,
  statuses,
  initialPlatform,
  onJobStarted,
}: ConnectPlatformModalProps) {
  const [selected, setSelected] = useState<SyncPlatform>(
    initialPlatform ?? SYNC_PLATFORMS[0]
  );
  const [cookieInput, setCookieInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(initialPlatform ?? SYNC_PLATFORMS[0]);
    setCookieInput("");
    setError(null);
  }, [open, initialPlatform]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const selectedStatus =
    statuses?.find((status) => status.platform === selected) ?? null;
  const selectedLabel = PLATFORM_LABELS[selected];
  const jobActive = isJobActive(selectedStatus?.latestJob);

  async function handleConnect() {
    const trimmed = cookieInput.trim();
    if (!trimmed) {
      setError("Paste your session cookies first.");
      return;
    }
    // The API accepts either a raw Cookie header string or a JSON array of
    // { name, value } objects (as exported by cookie extensions).
    let cookies: unknown = trimmed;
    if (trimmed.startsWith("[")) {
      try {
        cookies = JSON.parse(trimmed);
      } catch {
        // Not JSON after all; send as a raw header string.
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/import-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: selected, cookies }),
      });
      const data: { error?: string } | null = await res
        .json()
        .catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setCookieInput("");
      onJobStarted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Connect a platform"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Connect a platform
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Link your accounts to import your likes and collections. Cookies
              are stored encrypted and only used for syncing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {SYNC_PLATFORMS.map((platform) => {
            const status = statuses?.find((s) => s.platform === platform);
            const isSelected = platform === selected;
            return (
              <button
                key={platform}
                type="button"
                onClick={() => {
                  setSelected(platform);
                  setError(null);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {PLATFORM_LABELS[platform]}
                {status?.connected && (
                  <Check className="size-3.5 text-emerald-400" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {selectedStatus && <SyncStatusLine status={selectedStatus} />}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-zinc-300">
              {selectedStatus?.connected
                ? `Update your ${selectedLabel} session cookies`
                : `Paste your ${selectedLabel} session cookies`}
            </span>
            <textarea
              value={cookieInput}
              onChange={(event) => setCookieInput(event.target.value)}
              rows={4}
              placeholder="session=abc123; csrftoken=def456"
              className="resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/60 focus:outline-none"
            />
          </label>
          <p className="text-xs text-zinc-500">
            Sign in to {selectedLabel} in your browser, open DevTools → Network,
            select any request, and copy the <code>Cookie</code> request header.
            A JSON cookie array from a cookie-export extension also works.
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleConnect}
            disabled={submitting || jobActive}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            {selectedStatus?.connected
              ? `Reconnect ${selectedLabel} & Sync`
              : `Connect ${selectedLabel} & Sync`}
          </button>
        </div>
      </div>
    </div>
  );
}
