"use client";

import { useMemo, useState } from "react";
import { ExternalLink, FolderHeart, Heart, Search, SlidersHorizontal } from "lucide-react";
import { platformBadges } from "@/components/ModelCard";
import { platformOptions } from "@/components/SidebarFilters";
import type { SourcePlatform } from "@/types/model";

export interface LikedModelItem {
  id: string;
  title: string;
  externalUrl: string;
  thumbnailUrl: string | null;
  sourcePlatform: string;
  originalLikesCount: number;
  collectionName: string | null;
}

function badgeFor(platform: string) {
  return (
    platformBadges[platform as SourcePlatform] ?? {
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      className: "bg-zinc-700 text-zinc-100",
    }
  );
}

interface LikedModelsBrowserProps {
  items: ReadonlyArray<LikedModelItem>;
}

export function LikedModelsBrowser({ items }: LikedModelsBrowserProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);

  // Platforms that actually appear in the user's synced likes, with counts,
  // ordered like the global platform list (unknown platforms last).
  const platforms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.sourcePlatform, (counts.get(item.sourcePlatform) ?? 0) + 1);
    }
    const knownOrder = platformOptions.map((p) => p.id as string);
    return [...counts.entries()]
      .map(([id, count]) => ({ id, label: badgeFor(id).label, count }))
      .sort((a, b) => {
        const ai = knownOrder.indexOf(a.id);
        const bi = knownOrder.indexOf(b.id);
        return (ai === -1 ? knownOrder.length : ai) - (bi === -1 ? knownOrder.length : bi);
      });
  }, [items]);

  // null means "no filter applied yet" — every platform selected.
  const selectedPlatforms = useMemo(
    () => selected ?? new Set(platforms.map((p) => p.id)),
    [selected, platforms]
  );

  function togglePlatform(platform: string) {
    const next = new Set(selectedPlatforms);
    if (next.has(platform)) {
      next.delete(platform);
    } else {
      next.add(platform);
    }
    setSelected(next);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!selectedPlatforms.has(item.sourcePlatform)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.collectionName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, query, selectedPlatforms]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-20 text-center">
        <Heart className="size-10 text-zinc-600" />
        <p className="text-sm text-zinc-500">
          No likes imported yet. Link your accounts on the Account Sync page to
          bring in your likes and collections.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="search" className="relative">
        <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter your likes and collections…"
          aria-label="Filter your likes and collections"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-60">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <SlidersHorizontal className="size-3.5" />
              Platforms
            </h2>
            <fieldset className="mt-3 flex flex-col gap-0.5">
              <legend className="sr-only">Filter by platform</legend>
              {platforms.map(({ id, label, count }) => {
                const checked = selectedPlatforms.has(id);
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
                      checked ? "text-zinc-100" : "text-zinc-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlatform(id)}
                      className="size-4 rounded border-zinc-700 accent-indigo-500"
                    />
                    <span className="flex-1">{label}</span>
                    <span className="text-xs text-zinc-500">{count}</span>
                  </label>
                );
              })}
            </fieldset>
          </section>
        </aside>

        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center gap-3 self-start rounded-xl border border-dashed border-zinc-800 py-20 text-center">
            <Search className="size-10 text-zinc-600" />
            <p className="text-sm text-zinc-500">
              No likes match your current search and platform filters.
            </p>
          </div>
        ) : (
          <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <LikedModelCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LikedModelCard({ item }: { item: LikedModelItem }) {
  const badge = badgeFor(item.sourcePlatform);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-700">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
        {item.thumbnailUrl ? (
          /* Thumbnails come from arbitrary third-party CDNs, so next/image
             remotePatterns can't enumerate them; use a plain lazy <img>. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={item.thumbnailUrl}
            alt={item.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Heart className="size-8 text-zinc-600" />
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-xs font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex flex-1 items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-medium text-zinc-100"
            title={item.title}
          >
            {item.title}
          </h3>
          <p className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Heart className="size-3 fill-current text-rose-500" />
              {item.originalLikesCount}
            </span>
            {item.collectionName && (
              <span
                className="flex min-w-0 items-center gap-1"
                title={`Collection: ${item.collectionName}`}
              >
                <FolderHeart className="size-3 shrink-0" />
                <span className="truncate">{item.collectionName}</span>
              </span>
            )}
          </p>
        </div>
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${item.title} on ${badge.label}`}
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </article>
  );
}
