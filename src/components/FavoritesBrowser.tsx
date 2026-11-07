"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  Box,
  Download,
  ExternalLink,
  Folder,
  FolderPlus,
  Heart,
  Search,
  Shapes,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { platformBadges, PREVIEWABLE_PLATFORMS } from "@/components/ModelCard";
import { categoryOptions, platformOptions } from "@/components/SidebarFilters";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import { CollectionPickerModal } from "@/components/CollectionPickerModal";
import { CollectionsPanel, type CollectionFilter } from "@/components/CollectionsPanel";
import { FilterDrawer } from "@/components/FilterDrawer";
import { ModelPreviewModal } from "@/components/ModelPreviewModal";
import { compareCollections, type CollectionSummary } from "@/lib/collection-names";
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
  // Ids of the collections this favorite is filed in. Independent of
  // `category`: a favorite has one category and any number of collections.
  collectionIds: string[];
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

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

// Calls the /api/collections endpoints. They answer errors with
// { error: string } (never internals), so that message is safe to show;
// anything else (a 500 page, a proxy error) falls back to the status code.
async function callCollectionsApi<T = unknown>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  fallback: string
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null);
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `${fallback} (${response.status}).`;
      return { ok: false, status: response.status, message };
    }
    return { ok: true, data: (await response.json().catch(() => null)) as T };
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
}

interface FavoritesBrowserProps {
  initialItems: ReadonlyArray<FavoriteListItem>;
  initialCollections: ReadonlyArray<CollectionSummary>;
}

export function FavoritesBrowser({ initialItems, initialCollections }: FavoritesBrowserProps) {
  const [items, setItems] = useState<ReadonlyArray<FavoriteListItem>>(initialItems);
  const [collections, setCollections] =
    useState<ReadonlyArray<CollectionSummary>>(initialCollections);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>("all");
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<FavoriteListItem | null>(null);
  // The favorite whose "Add to collection" dialog is open. Held as an id so
  // the dialog always reads the live item, including optimistic changes.
  const [pickerItemId, setPickerItemId] = useState<string | null>(null);
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

  // How many favorites each collection holds, and how many are in none.
  const { collectionCounts, uncollectedCount } = useMemo(() => {
    const counts = new Map<string, number>();
    let uncollected = 0;
    for (const item of items) {
      if (item.collectionIds.length === 0) uncollected += 1;
      for (const id of item.collectionIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return { collectionCounts: counts, uncollectedCount: uncollected };
  }, [items]);

  // The favorite shown in the "Add to collection" dialog, if any.
  const pickerItem = useMemo(
    () => items.find((item) => item.id === pickerItemId) ?? null,
    [items, pickerItemId]
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

  // The collection handlers below resolve to an error message for the panel
  // or dialog that triggered them to show next to its controls (the notice
  // banner above would sit behind the dialog), or null on success.

  async function createCollection(
    name: string
  ): Promise<{ collection: CollectionSummary } | { error: string }> {
    const result = await callCollectionsApi<{ collection: CollectionSummary }>(
      "/api/collections",
      "POST",
      { name },
      "Creating the collection failed"
    );
    if (!result.ok) return { error: result.message };
    const collection = { id: result.data.collection.id, name: result.data.collection.name };
    setCollections((prev) => [...prev, collection].sort(compareCollections));
    return { collection };
  }

  async function renameCollection(
    collection: CollectionSummary,
    name: string
  ): Promise<string | null> {
    if (name === collection.name) return null;
    const result = await callCollectionsApi<{ collection: CollectionSummary }>(
      `/api/collections/${encodeURIComponent(collection.id)}`,
      "PATCH",
      { name },
      "Renaming the collection failed"
    );
    if (!result.ok) return result.message;
    const renamed = result.data.collection.name;
    setCollections((prev) =>
      prev
        .map((c) => (c.id === collection.id ? { ...c, name: renamed } : c))
        .sort(compareCollections)
    );
    return null;
  }

  async function deleteCollection(collection: CollectionSummary): Promise<string | null> {
    const result = await callCollectionsApi(
      `/api/collections/${encodeURIComponent(collection.id)}`,
      "DELETE",
      undefined,
      "Deleting the collection failed"
    );
    // 404 means it was already deleted elsewhere — the end state the user asked for.
    if (!result.ok && result.status !== 404) return result.message;
    setCollections((prev) => prev.filter((c) => c.id !== collection.id));
    setItems((prev) =>
      prev.map((f) =>
        f.collectionIds.includes(collection.id)
          ? { ...f, collectionIds: f.collectionIds.filter((id) => id !== collection.id) }
          : f
      )
    );
    setCollectionFilter((prev) => (prev === collection.id ? "all" : prev));
    return null;
  }

  // Optimistic like changeCategory: the checkbox flips at once and is put
  // back if the server refuses.
  async function setMembership(
    item: FavoriteListItem,
    collection: CollectionSummary,
    member: boolean
  ): Promise<string | null> {
    const apply = (filed: boolean) =>
      setItems((prev) =>
        prev.map((f) => {
          if (f.id !== item.id) return f;
          const others = f.collectionIds.filter((id) => id !== collection.id);
          return { ...f, collectionIds: filed ? [...others, collection.id] : others };
        })
      );
    apply(member);

    const base = `/api/collections/${encodeURIComponent(collection.id)}/items`;
    const result = member
      ? await callCollectionsApi(
          base,
          "POST",
          { favoriteId: item.id },
          "Adding to the collection failed"
        )
      : await callCollectionsApi(
          `${base}?favoriteId=${encodeURIComponent(item.id)}`,
          "DELETE",
          undefined,
          "Removing from the collection failed"
        );
    // A 404 on removal means it is already out of the collection.
    if (result.ok || (!member && result.status === 404)) return null;
    apply(!member);
    return result.message;
  }

  // "New collection" in the dialog: create it, then file the favorite in it.
  async function createCollectionFor(
    item: FavoriteListItem,
    name: string
  ): Promise<string | null> {
    const created = await createCollection(name);
    if ("error" in created) return created.error;
    const failure = await setMembership(item, created.collection, true);
    return failure
      ? `Created "${created.collection.name}", but this favorite wasn't added: ${failure}`
      : null;
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
      // Combines with the category filter above: both have to match.
      if (collectionFilter === "none" && item.collectionIds.length > 0) return false;
      if (
        collectionFilter !== "all" &&
        collectionFilter !== "none" &&
        !item.collectionIds.includes(collectionFilter)
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
  }, [items, query, selectedPlatforms, categoryFilter, collectionFilter, sortBy]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-20 text-center">
        <Heart className="size-10 text-zinc-600" />
        <p className="max-w-md text-sm text-zinc-500">
          No favorites yet. Hit the heart on any search result to save it here,
          organized by category and collection.
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
                favoritesToJson(filtered, collections),
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
                favoritesToCsv(filtered, collections),
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

          <CollectionsPanel
            collections={collections}
            counts={collectionCounts}
            totalCount={items.length}
            uncollectedCount={uncollectedCount}
            filter={collectionFilter}
            onFilterChange={setCollectionFilter}
            onCreate={async (name) => {
              const created = await createCollection(name);
              return "error" in created ? created.error : null;
            }}
            onRename={renameCollection}
            onDelete={deleteCollection}
          />

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
                // `collections` is already sorted by name.
                collectionNames={collections
                  .filter((collection) => item.collectionIds.includes(collection.id))
                  .map((collection) => collection.name)}
                onChangeCategory={changeCategory}
                onOpenCollections={(favorite) => setPickerItemId(favorite.id)}
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

      {pickerItem && (
        <CollectionPickerModal
          favoriteTitle={pickerItem.title}
          collections={collections}
          memberIds={pickerItem.collectionIds}
          onToggle={(collection, member) => setMembership(pickerItem, collection, member)}
          onCreate={(name) => createCollectionFor(pickerItem, name)}
          onClose={() => setPickerItemId(null)}
        />
      )}
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
  collectionNames,
  onChangeCategory,
  onOpenCollections,
  onRemove,
  onPreview,
}: {
  item: FavoriteListItem;
  categoryOptions: ReadonlyArray<{ value: string; label: string }>;
  // Names of the collections the favorite is in.
  collectionNames: ReadonlyArray<string>;
  onChangeCategory: (item: FavoriteListItem, next: string | null) => void;
  onOpenCollections: (item: FavoriteListItem) => void;
  onRemove: (item: FavoriteListItem) => void;
  onPreview: (item: FavoriteListItem) => void;
}) {
  const badge = badgeFor(item.sourcePlatform);
  const previewable = PREVIEWABLE_PLATFORMS.has(item.sourcePlatform as SourcePlatform);
  const collectionSummary = collectionNames.join(", ");

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

        <button
          type="button"
          onClick={() => onOpenCollections(item)}
          aria-haspopup="dialog"
          aria-label={
            collectionNames.length > 0
              ? `Collections for ${item.title}: ${collectionSummary}. Change collections`
              : `Add ${item.title} to a collection`
          }
          title={collectionSummary || undefined}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-left text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus:border-indigo-500 focus:outline-none"
        >
          {collectionNames.length > 0 ? (
            <Folder className="size-3.5 shrink-0 text-indigo-400" />
          ) : (
            <FolderPlus className="size-3.5 shrink-0 text-zinc-500" />
          )}
          <span
            className={`min-w-0 flex-1 truncate ${
              collectionNames.length > 0 ? "" : "text-zinc-500"
            }`}
          >
            {collectionNames.length > 0 ? collectionSummary : "Add to collection"}
          </span>
        </button>
      </div>
    </article>
  );
}
