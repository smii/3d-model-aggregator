"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  Box,
  Download,
  ExternalLink,
  Heart,
  Search,
  Shapes,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { platformBadges, PREVIEWABLE_PLATFORMS } from "@/components/ModelCard";
import { categoryOptions, platformOptions } from "@/components/SidebarFilters";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { FilterDrawer } from "@/components/FilterDrawer";
import { ModelPreviewModal } from "@/components/ModelPreviewModal";
import { getFavoriteCategoryOptions } from "@/lib/favorite-categories";
import { downloadTextFile, favoritesToCsv, favoritesToJson } from "@/lib/export-favorites";
import type { SourcePlatform } from "@/types/model";

export interface FavoriteListItem {
  id: string;
  externalId: string;
  title: string;
  author: string;
  externalUrl: string;
  thumbnailUrl: string | null;
  sourcePlatform: string;
  likesCount: number;
  // A platform-native category id (src/types/model.ts) or a user-created
  // custom category string.
  category: string | null;
  createdAt: string;
}

// Sidebar radio value: "all" | "uncategorized" | a category value
type CategoryFilter = "all" | "uncategorized" | string;

type SortBy = "newest" | "oldest" | "most_liked" | "title";
const sortOptions: ReadonlyArray<{ id: SortBy; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "most_liked", label: "Most Liked" },
  { id: "title", label: "Title (A–Z)" },
];

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
  const [previewItem, setPreviewItem] = useState<FavoriteListItem | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("newest");

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
  // sidebar in the global category order, then any custom categories
  // alphabetically, with "uncategorized" last.
  const categories = useMemo(() => {
    const counts = new Map<CategoryFilter, number>();
    for (const item of items) {
      const key: CategoryFilter = item.category ?? "uncategorized";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ordered: { id: CategoryFilter; label: string; count: number }[] = [];
    const seen = new Set<string>();
    for (const { id, label } of categoryOptions) {
      const count = counts.get(id);
      if (count) {
        ordered.push({ id, label, count });
        seen.add(id);
      }
    }
    const customs = [...counts.keys()]
      .filter((key) => key !== "uncategorized" && !seen.has(key))
      .sort((a, b) => a.localeCompare(b));
    for (const custom of customs) {
      ordered.push({ id: custom, label: custom, count: counts.get(custom)! });
    }
    const uncategorized = counts.get("uncategorized");
    if (uncategorized) {
      ordered.push({ id: "uncategorized", label: "Uncategorized", count: uncategorized });
    }
    return ordered;
  }, [items]);

  // Suggestion list for the per-card category picker: defaults + every
  // custom category already in use across favorites.
  const categoryPickerOptions = useMemo(
    () => getFavoriteCategoryOptions(items.map((item) => item.category)),
    [items]
  );

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

  async function changeCategory(item: FavoriteListItem, next: string | null) {
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
    const matches = items.filter((item) => {
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

    const sorted = [...matches];
    switch (sortBy) {
      case "oldest":
        sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case "most_liked":
        sorted.sort((a, b) => b.likesCount - a.likesCount);
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "newest":
      default:
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [items, query, selectedPlatforms, categoryFilter, sortBy]);

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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div role="search" className="relative flex-1">
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
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                "favorites.json",
                favoritesToJson(filtered),
                "application/json"
              )
            }
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <Download className="size-4" />
            JSON
          </button>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                "favorites.csv",
                favoritesToCsv(filtered),
                "text/csv"
              )
            }
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <Download className="size-4" />
            CSV
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <FilterDrawer>
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

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <ArrowDownWideNarrow className="size-3.5" />
              Sort by
            </h2>
            <fieldset className="mt-3 flex flex-col gap-0.5">
              <legend className="sr-only">Sort favorites</legend>
              {sortOptions.map(({ id, label }) => {
                const active = sortBy === id;
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
                      active ? "text-zinc-100" : "text-zinc-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="favorites-sort"
                      checked={active}
                      onChange={() => setSortBy(id)}
                      className="size-4 accent-indigo-500"
                    />
                    {label}
                  </label>
                );
              })}
            </fieldset>
          </section>
        </aside>
        </FilterDrawer>

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
                categoryOptions={categoryPickerOptions}
                onChangeCategory={changeCategory}
                onRemove={removeFavorite}
                onPreview={setPreviewItem}
              />
            ))}
          </div>
        )}
      </div>

      <ModelPreviewModal
        open={previewItem !== null}
        modelTitle={previewItem?.title ?? null}
        platform={previewItem?.sourcePlatform ?? null}
        externalId={previewItem?.externalId ?? null}
        onClose={() => setPreviewItem(null)}
      />
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
  categoryOptions: pickerOptions,
  onChangeCategory,
  onRemove,
  onPreview,
}: {
  item: FavoriteListItem;
  categoryOptions: ReadonlyArray<{ value: string; label: string }>;
  onChangeCategory: (item: FavoriteListItem, next: string | null) => void;
  onRemove: (item: FavoriteListItem) => void;
  onPreview: (item: FavoriteListItem) => void;
}) {
  const badge = badgeFor(item.sourcePlatform);
  const previewable = PREVIEWABLE_PLATFORMS.has(item.sourcePlatform as SourcePlatform);

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
        <div className="absolute right-2 top-2 flex gap-1.5">
          {previewable && (
            <button
              type="button"
              onClick={() => onPreview(item)}
              aria-label={`Preview ${item.title} in 3D`}
              className="rounded-full bg-zinc-950/70 p-2 text-zinc-300 backdrop-blur-sm transition-colors hover:text-zinc-100"
            >
              <Box className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(item)}
            aria-label="Remove from favorites"
            className="rounded-full bg-zinc-950/70 p-2 text-rose-500 backdrop-blur-sm transition-colors hover:text-rose-400"
          >
            <Heart className="size-4 fill-current" />
          </button>
        </div>
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

        <CategoryCombobox
          value={item.category}
          options={pickerOptions}
          onChange={(next) => onChangeCategory(item, next)}
          ariaLabel={`Category for ${item.title}`}
        />
      </div>
    </article>
  );
}
