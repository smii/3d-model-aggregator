"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { categoryOptions, platformOptions } from "@/components/SidebarFilters";

export interface SavedSearchListItem {
  id: string;
  name: string;
  query: string;
  platforms: string[];
  category: string | null;
  sort: string;
  newResultsCount: number;
  lastRunAt: string | null;
  lastError: string | null;
}

const categoryLabels = new Map<string, string>(
  categoryOptions.map(({ id, label }) => [id, label])
);
const platformLabels = new Map<string, string>(
  platformOptions.map(({ id, label }) => [id, label])
);
const sortLabels: Record<string, string> = {
  newest: "Newest",
  most_liked: "Most Liked",
  most_downloaded: "Most Downloaded",
};

function searchUrl(item: SavedSearchListItem): string {
  const params = new URLSearchParams({ q: item.query });
  if (item.platforms.length > 0) params.set("platforms", item.platforms.join(","));
  if (item.category) params.set("category", item.category);
  if (item.sort !== "newest") params.set("sort", item.sort);
  return `/?${params.toString()}`;
}

function formatLastRun(lastRunAt: string | null): string {
  if (!lastRunAt) return "Never run yet";
  const diffMs = Date.now() - new Date(lastRunAt).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface SavedSearchesBrowserProps {
  initialItems: ReadonlyArray<SavedSearchListItem>;
}

export function SavedSearchesBrowser({ initialItems }: SavedSearchesBrowserProps) {
  const [items, setItems] = useState<ReadonlyArray<SavedSearchListItem>>(initialItems);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function runNow(item: SavedSearchListItem) {
    setRunningId(item.id);
    try {
      const response = await fetch(`/api/saved-searches/run?id=${encodeURIComponent(item.id)}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`Run failed (${response.status}).`);
      const refreshed = await fetch("/api/saved-searches");
      if (refreshed.ok) {
        const data = (await refreshed.json()) as { savedSearches: SavedSearchListItem[] };
        setItems(data.savedSearches);
      }
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Run failed.");
    } finally {
      setRunningId(null);
    }
  }

  async function remove(item: SavedSearchListItem) {
    setItems((prev) => prev.filter((s) => s.id !== item.id));
    try {
      const response = await fetch(
        `/api/saved-searches/${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(`Removing saved search failed (${response.status}).`);
      }
      setNotice(null);
    } catch (error) {
      setItems((prev) => [item, ...prev]);
      setNotice(error instanceof Error ? error.message : "Removing saved search failed.");
    }
  }

  function markSeen(item: SavedSearchListItem) {
    if (item.newResultsCount === 0) return;
    setItems((prev) =>
      prev.map((s) => (s.id === item.id ? { ...s, newResultsCount: 0 } : s))
    );
    // Fire-and-forget with keepalive so it still completes as the browser
    // navigates away to the loaded search.
    fetch(`/api/saved-searches/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markSeen: true }),
      keepalive: true,
    }).catch(() => {});
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-20 text-center">
        <Bell className="size-10 text-zinc-600" />
        <p className="max-w-md text-sm text-zinc-500">
          No saved searches yet. Run a search and use &quot;Save this
          search&quot; to get notified here when new results show up.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-zinc-100">
                  {item.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  &quot;{item.query}&quot;
                </p>
              </div>
              {item.newResultsCount > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                  <Bell className="size-3" />
                  {item.newResultsCount} new
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs text-zinc-500">
              {item.platforms.length > 0 ? (
                item.platforms.map((platform) => (
                  <span
                    key={platform}
                    className="rounded-md bg-zinc-800 px-1.5 py-0.5"
                  >
                    {platformLabels.get(platform) ?? platform}
                  </span>
                ))
              ) : (
                <span className="rounded-md bg-zinc-800 px-1.5 py-0.5">
                  All platforms
                </span>
              )}
              {item.category && (
                <span className="rounded-md bg-zinc-800 px-1.5 py-0.5">
                  {categoryLabels.get(item.category) ?? item.category}
                </span>
              )}
              <span className="rounded-md bg-zinc-800 px-1.5 py-0.5">
                {sortLabels[item.sort] ?? item.sort}
              </span>
            </div>

            <p className="text-xs text-zinc-600">
              {formatLastRun(item.lastRunAt)}
              {item.lastError && (
                <span className="ml-2 text-amber-500">{item.lastError}</span>
              )}
            </p>

            <div className="mt-auto flex items-center gap-2 pt-1">
              <Link
                href={searchUrl(item)}
                onClick={() => markSeen(item)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                <Search className="size-3.5" />
                Open
              </Link>
              <button
                type="button"
                onClick={() => runNow(item)}
                disabled={runningId === item.id}
                aria-label={`Run "${item.name}" now`}
                className="rounded-lg border border-zinc-700 p-2 text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-4 ${runningId === item.id ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Delete "${item.name}"`}
                className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:border-red-900/60 hover:bg-red-950/30 hover:text-red-300"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
