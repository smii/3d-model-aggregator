"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  Heart,
  Search,
  Shapes,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { platformBadges } from "@/components/ModelCard";
import { categoryOptions, platformOptions } from "@/components/SidebarFilters";
import type { ModelCategory, SourcePlatform } from "@/types/model";

export interface FavoriteListItem {
  id: string;
  externalId: string;
  title: string;
  author: string;
  externalUrl: string;
  thumbnailUrl: string | null;
  sourcePlatform: string;
  likesCount: number;
  category: ModelCategory | null;
}

// Sidebar radio value: "all" | "uncategorized" | ModelCategory
type CategoryFilter = "all" | "uncategorized" | ModelCategory;

const categoryLabels = new Map<string, string>(
  categoryOptions.map(({ id, label }) => [id, label])
);

function badgeFor(platform: string) {
  return (
    platformBadges[platform as SourcePlatform] ?? {
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      className: "bg-zinc-700 text-zinc-100",
    }
  );
}

interface FavoritesBrowserProps {
  initialItems: ReadonlyArray<FavoriteListItem>;
}

export function FavoritesBrowser({ initialItems }: FavoritesBrowserProps) {
  const [items, setItems] = useState<ReadonlyArray<FavoriteListItem>>(initialItems);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  // Categories present in the user's favorites, with counts. Shown in the
  // sidebar in the global category order; "uncategorized" appears last.
  const categories = useMemo(() => {
    const counts = new Map<CategoryFilter, number>();
    for (const item of items) {
      const key: CategoryFilter = item.category ?? "uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ordered: { id: CategoryFilter; label: string; count: number }[] = [];
    for (const { id, label } of categoryOptions) {
      const count = counts.get(id);
      if (count) ordered.push({ id, label, count });
    }
    const uncategorized = counts.get("uncategorized");
    if (uncategorized) {
      ordered.push({ id: "uncategorized", label: "Uncategorized", count: uncategorized });
    }
    return ordered;
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

  async function changeCategory(item: FavoriteListItem, next: ModelCategory | null) {
    const previous = item.category;
    setItems((prev) =>
      prev.map((f) => (f.id === item.id ? { ...f, category: next } : f))
    );
    try {
      const response = await fetch("/api/favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, category: next }),
      });
      if (!response.ok) {
        throw new Error(`Updating category failed (${response.status}).`);
      }
      setNotice(null);
    } catch (error) {
      setItems((prev) =>
        prev.map((f) => (f.id === item.id ? { ...f, category: previous } : f))
      );
      setNotice(
        error instanceof Error ? error.message : "Updating category failed."
      );
    }
  }

  async function removeFavorite(item: FavoriteListItem) {
    setItems((prev) => prev.filter((f) => f.id !== item.id));
    try {
      const response = await fetch(
        `/api/favorites?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" }
      );
      // 404 means it was already removed elsewhere — nothing to restore.
      if (!response.ok && response.status !== 404) {
        throw new Error(`Removing favorite failed (${response.status}).`);
      }
      setNotice(null);
    } catch (error) {
      setItems((prev) => [item, ...prev]);
      setNotice(
        error instanceof Error ? error.message : "Removing favorite failed."
      );
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!selectedPlatforms.has(item.sourcePlatform)) return false;
      if (categoryFilter === "uncategorized" && item.category !== null) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== "uncategorized" &&
        item.category !== categoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q)
      );
    });
  }, [items, query, selectedPlatforms, categoryFilter]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-20 text-center">
        <Heart className="size-10 text-zinc-600" />
        <p className="max-w-md text-sm text-zinc-500">
          No favorites yet. Hit the heart on any search result to save it here,
          organized by category.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      <div role="search" className="relative">
        <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter your favorites…"
          aria-label="Filter your favorites"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-60">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Shapes className="size-3.5" />
              Category
            </h2>
            <fieldset className="mt-3 flex flex-col gap-0.5">
              <legend className="sr-only">Filter by category</legend>
              <CategoryRadio
                label="All categories"
                count={items.length}
                checked={categoryFilter === "all"}
                onChange={() => setCategoryFilter("all")}
              />
              {categories.map(({ id, label, count }) => (
                <CategoryRadio
                  key={id}
                  label={label}
                  count={count}
                  checked={categoryFilter === id}
                  onChange={() => setCategoryFilter(id)}
                />
              ))}
            </fieldset>
          </section>

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
              No favorites match your current filters.
            </p>
          </div>
        ) : (
          <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <FavoriteCard
                key={item.id}
                item={item}
                onChangeCategory={changeCategory}
                onRemove={removeFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryRadio({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
        checked ? "text-zinc-100" : "text-zinc-400"
      }`}
    >
      <input
        type="radio"
        name="favorites-category"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-indigo-500"
      />
      <span className="flex-1">{label}</span>
      <span className="text-xs text-zinc-500">{count}</span>
    </label>
  );
}

function FavoriteCard({
  item,
  onChangeCategory,
  onRemove,
}: {
  item: FavoriteListItem;
  onChangeCategory: (item: FavoriteListItem, next: ModelCategory | null) => void;
  onRemove: (item: FavoriteListItem) => void;
}) {
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
        <button
          type="button"
          onClick={() => onRemove(item)}
          aria-label="Remove from favorites"
          className="absolute right-2 top-2 rounded-full bg-zinc-950/70 p-2 text-rose-500 backdrop-blur-sm transition-colors hover:text-rose-400"
        >
          <Heart className="size-4 fill-current" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="truncate text-sm font-medium text-zinc-100"
              title={item.title}
            >
              {item.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-zinc-400">
              by {item.author}
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

        <select
          value={item.category ?? ""}
          onChange={(e) =>
            onChangeCategory(
              item,
              e.target.value === "" ? null : (e.target.value as ModelCategory)
            )
          }
          aria-label={`Category for ${item.title}`}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Uncategorized</option>
          {categoryOptions.map(({ id }) => (
            <option key={id} value={id}>
              {categoryLabels.get(id)}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
