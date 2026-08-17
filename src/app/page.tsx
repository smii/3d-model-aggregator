"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageOpen,
  TriangleAlert,
} from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { SidebarFilters, platformOptions } from "@/components/SidebarFilters";
import { FilterDrawer } from "@/components/FilterDrawer";
import { ModelGrid } from "@/components/ModelGrid";
import { FavoriteCategoryModal } from "@/components/FavoriteCategoryModal";
import { ModelPreviewModal } from "@/components/ModelPreviewModal";
import { SaveSearchModal } from "@/components/SaveSearchModal";
import { getFavoriteCategoryOptions } from "@/lib/favorite-categories";
import { mergeDuplicateGroups } from "@/lib/duplicate-groups";
import {
  isModelCategory,
  type ModelCategory,
  type SortOption,
  type SourcePlatform,
  type UnifiedModelResult,
} from "@/types/model";

interface SearchResponse {
  results: UnifiedModelResult[];
  failures: { platform: SourcePlatform; error: string }[];
  skipped?: SourcePlatform[];
  error?: string;
}

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      results: UnifiedModelResult[];
      failures: SearchResponse["failures"];
      skipped: SourcePlatform[];
    };

export default function Home() {
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}

function SearchPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<SourcePlatform>>(
    () =>
      new Set(platformOptions.filter((p) => !p.unavailable).map((p) => p.id))
  );
  const [sort, setSort] = useState<SortOption>("newest");
  const [freeOnly, setFreeOnly] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<ReadonlySet<string>>(new Set());
  const [mergeDuplicates, setMergeDuplicates] = useState(true);
  const [category, setCategory] = useState<ModelCategory | null>(null);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [page, setPage] = useState(1);
  // Keys ("platform:externalId") of models already in the local favorites
  // database (device-scoped for anonymous visitors, account-scoped when
  // signed in).
  const [savedKeys, setSavedKeys] = useState<ReadonlySet<string>>(new Set());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  // Every category already used across the local favorites database, kept
  // up to date so the "pick a category" modal can suggest previously-used
  // custom categories, not just the 10 defaults.
  const [knownCategories, setKnownCategories] = useState<
    ReadonlyArray<string | null>
  >([]);
  // The favorite awaiting a category choice right after being saved.
  const [pendingFavorite, setPendingFavorite] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [previewModel, setPreviewModel] = useState<UnifiedModelResult | null>(
    null
  );
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [saveSearchNotice, setSaveSearchNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const seededFromUrl = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/favorites", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          favorites: {
            sourcePlatform: string;
            externalId: string;
            category: string | null;
          }[];
        };
        setSavedKeys(
          new Set(
            data.favorites.map((f) => `${f.sourcePlatform}:${f.externalId}`)
          )
        );
        setKnownCategories(data.favorites.map((f) => f.category));
      } catch {
        // Non-fatal: hearts just start unsaved.
      }
    })();
    return () => controller.abort();
  }, []);

  // Bootstraps state from a saved search's "Open" link (?q=&platforms=&category=&sort=).
  // Runs the search directly from the parsed URL values rather than going
  // through runSearch()/state, since setQuery/setSelected here wouldn't have
  // committed yet in the same tick that runSearch would read them.
  useEffect(() => {
    if (seededFromUrl.current) return;
    seededFromUrl.current = true;
    const urlQuery = searchParams.get("q");
    if (!urlQuery) return;

    const urlPlatforms = searchParams.get("platforms");
    const urlCategory = searchParams.get("category");
    const urlSort = searchParams.get("sort");

    setQuery(urlQuery);
    if (urlPlatforms) {
      setSelected(new Set(urlPlatforms.split(",") as SourcePlatform[]));
    }
    if (urlCategory && isModelCategory(urlCategory)) {
      setCategory(urlCategory);
    }
    if (urlSort === "most_liked" || urlSort === "most_downloaded" || urlSort === "newest") {
      setSort(urlSort);
    }

    (async () => {
      setPage(1);
      setSearch({ status: "loading" });
      try {
        const params = new URLSearchParams({ q: urlQuery, page: "1" });
        if (urlPlatforms) params.set("platforms", urlPlatforms);
        if (urlCategory) params.set("category", urlCategory);
        const response = await fetch(`/api/search?${params}`);
        const data = (await response.json()) as SearchResponse;
        if (!response.ok) {
          throw new Error(data.error ?? `Search failed (${response.status})`);
        }
        setSearch({
          status: "done",
          results: data.results,
          failures: data.failures,
          skipped: data.skipped ?? [],
        });
      } catch (error) {
        setSearch({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }, [searchParams]);

  const categoryPickerOptions = useMemo(
    () => getFavoriteCategoryOptions(knownCategories),
    [knownCategories]
  );

  async function confirmFavoriteCategory(nextCategory: string | null) {
    const pending = pendingFavorite;
    setPendingFavorite(null);
    if (!pending || !nextCategory) return;
    try {
      const response = await fetch("/api/favorites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pending.id, category: nextCategory }),
      });
      if (!response.ok) {
        throw new Error(`Updating category failed (${response.status}).`);
      }
      setKnownCategories((prev) => [...prev, nextCategory]);
    } catch (error) {
      setSaveNotice(
        error instanceof Error ? error.message : "Updating category failed."
      );
    }
  }

  async function confirmSaveSearch(name: string) {
    try {
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          query: query.trim(),
          platforms: [...selected],
          category,
          sort,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? `Saving search failed (${response.status}).`);
      }
      setSaveSearchOpen(false);
      setSaveSearchNotice(`Saved "${name}" — check the Saved Searches page for new results.`);
    } catch (error) {
      setSaveSearchNotice(
        error instanceof Error ? error.message : "Saving search failed."
      );
    }
  }

  function togglePlatform(platform: SourcePlatform) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  // Scrolls to the top of the results grid (just below the fixed header)
  // rather than all the way up to the search bar, so paging doesn't force
  // scrolling back down past filters/search to see the next page.
  function scrollToResults() {
    const el = resultsRef.current;
    if (!el) return;
    const headerOffset = 72;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  async function runSearch(
    targetPage = 1,
    categoryOverride?: ModelCategory | null
  ) {
    const q = query.trim();
    if (!q) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const activeCategory =
      categoryOverride === undefined ? category : categoryOverride;

    setPage(targetPage);
    setSearch({ status: "loading" });
    try {
      const params = new URLSearchParams({
        q,
        platforms: [...selected].join(","),
        page: String(targetPage),
      });
      if (activeCategory) {
        params.set("category", activeCategory);
      }
      const response = await fetch(`/api/search?${params}`, {
        signal: controller.signal,
      });
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) {
        throw new Error(data.error ?? `Search failed (${response.status})`);
      }
      setSearch({
        status: "done",
        results: data.results,
        failures: data.failures,
        skipped: data.skipped ?? [],
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      setSearch({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function changeCategory(next: ModelCategory | null) {
    setCategory(next);
    // Re-run an active search immediately so the filter takes effect without
    // requiring another manual submit.
    if (search.status !== "idle" && query.trim()) {
      runSearch(1, next);
    }
  }

  async function toggleSave(model: UnifiedModelResult) {
    const key = `${model.sourcePlatform}:${model.id}`;
    const adding = !savedKeys.has(key);

    // Optimistic update; reverted if the request fails.
    setSavedKeys((prev) => {
      const next = new Set(prev);
      if (adding) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });

    try {
      const response = adding
        ? await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              externalId: model.id,
              title: model.title,
              author: model.author,
              externalUrl: model.externalUrl,
              thumbnailUrl: model.thumbnailUrl,
              sourcePlatform: model.sourcePlatform,
              likesCount: model.likesCount,
              license: model.license,
              // A favorite saved while browsing a category inherits it.
              category,
            }),
          })
        : await fetch(
            `/api/favorites?platform=${encodeURIComponent(
              model.sourcePlatform
            )}&externalId=${encodeURIComponent(model.id)}`,
            { method: "DELETE" }
          );

      // 404 on delete means it was already gone — fine for a toggle.
      if (!response.ok && !(response.status === 404 && !adding)) {
        throw new Error(`Saving favorite failed (${response.status}).`);
      }
      if (adding) {
        const data = (await response.json()) as {
          favorite: { id: string };
        };
        setPendingFavorite({ id: data.favorite.id, title: model.title });
      }
      setSaveNotice(null);
    } catch (error) {
      setSavedKeys((prev) => {
        const next = new Set(prev);
        if (adding) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      setSaveNotice(
        error instanceof Error ? error.message : "Saving favorite failed."
      );
    }
  }

  // License options are derived before the license filter itself is applied
  // (platform/price only) so picking one doesn't collapse the other options.
  const licenseOptions = useMemo(() => {
    if (search.status !== "done") return [];
    const base = search.results
      .filter((result) => selected.has(result.sourcePlatform))
      .filter((result) => !freeOnly || result.price === null);
    const counts = new Map<string, number>();
    for (const result of base) {
      counts.set(result.license, (counts.get(result.license) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([license, count]) => ({ license, count }))
      .sort((a, b) => b.count - a.count);
  }, [search, selected, freeOnly]);

  const visibleResults = useMemo(() => {
    if (search.status !== "done") return [];
    let filtered = search.results
      .filter((result) => selected.has(result.sourcePlatform))
      .filter((result) => !freeOnly || result.price === null)
      .filter((result) => !selectedLicense || result.license === selectedLicense)
      .filter(
        (result) =>
          selectedTags.size === 0 ||
          result.tags.some((tag) => selectedTags.has(tag))
      )
      .map((result) => ({
        ...result,
        isLikedLocally: savedKeys.has(
          `${result.sourcePlatform}:${result.id}`
        ),
      }));

    if (mergeDuplicates) {
      filtered = mergeDuplicateGroups(filtered);
    }

    if (sort === "most_liked") {
      return [...filtered].sort((a, b) => b.likesCount - a.likesCount);
    }
    if (sort === "most_downloaded") {
      return [...filtered].sort((a, b) => b.downloadsCount - a.downloadsCount);
    }
    return filtered;
  }, [
    search,
    selected,
    sort,
    freeOnly,
    selectedLicense,
    selectedTags,
    mergeDuplicates,
    savedKeys,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Unified Search
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Search 3D printable models across every platform at once.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <SearchBar
            value={query}
            onChange={setQuery}
            onSubmit={() => {
              setSelectedLicense(null);
              setSelectedTags(new Set());
              runSearch();
            }}
          />
        </div>
        {query.trim() && (
          <button
            type="button"
            onClick={() => setSaveSearchOpen(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <Bell className="size-4" />
            Save this search
          </button>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <FilterDrawer>
          <SidebarFilters
            selectedPlatforms={selected}
            onTogglePlatform={togglePlatform}
            sort={sort}
            onSortChange={setSort}
            category={category}
            onCategoryChange={changeCategory}
            freeOnly={freeOnly}
            onFreeOnlyChange={setFreeOnly}
            licenseOptions={licenseOptions}
            license={selectedLicense}
            onLicenseChange={setSelectedLicense}
            selectedTags={selectedTags}
            onClearTag={toggleTag}
            mergeDuplicates={mergeDuplicates}
            onMergeDuplicatesChange={setMergeDuplicates}
          />
        </FilterDrawer>

        <div ref={resultsRef} className="flex flex-1 flex-col gap-4">
          {saveNotice && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{saveNotice}</p>
            </div>
          )}

          {saveSearchNotice && (
            <div className="flex items-start gap-2 rounded-xl border border-indigo-900/50 bg-indigo-950/30 px-4 py-3 text-sm text-indigo-300">
              <Bell className="mt-0.5 size-4 shrink-0" />
              <p>{saveSearchNotice}</p>
            </div>
          )}

          {search.status === "done" && search.skipped.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
              Category filtering isn&apos;t supported by{" "}
              {search.skipped.join(", ")} — results from{" "}
              {search.skipped.length === 1 ? "that platform" : "those platforms"}{" "}
              are hidden.
            </div>
          )}

          {search.status === "done" && search.failures.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                {search.failures
                  .map(({ platform, error }) => `${platform}: ${error}`)
                  .join(" · ")}
              </p>
            </div>
          )}

          {search.status === "idle" && (
            <EmptyState
              icon={<PackageOpen className="size-10 text-zinc-600" />}
              message={`Results will appear here. Start typing to search across ${
                selected.size
              } platform${selected.size === 1 ? "" : "s"}.`}
            />
          )}

          {search.status === "loading" && (
            <EmptyState
              icon={
                <Loader2 className="size-10 animate-spin text-indigo-500" />
              }
              message="Searching platforms…"
            />
          )}

          {search.status === "error" && (
            <EmptyState
              icon={<TriangleAlert className="size-10 text-rose-500" />}
              message={search.message}
            />
          )}

          {search.status === "done" &&
            (visibleResults.length > 0 ? (
              <>
                <ModelGrid
                  models={visibleResults}
                  onToggleSave={toggleSave}
                  onPreview={setPreviewModel}
                  onTagClick={toggleTag}
                  selectedTags={selectedTags}
                />
                <Pagination
                  page={page}
                  hasNext={search.results.length > 0}
                  onNavigate={(target) => {
                    runSearch(target);
                    scrollToResults();
                  }}
                />
              </>
            ) : (
              <EmptyState
                icon={<PackageOpen className="size-10 text-zinc-600" />}
                message={
                  page > 1
                    ? "No more results on the selected platforms."
                    : "No results found on the selected platforms."
                }
              />
            ))}
          {search.status === "done" && visibleResults.length === 0 && page > 1 && (
            <Pagination
              page={page}
              hasNext={false}
              onNavigate={(target) => {
                runSearch(target);
                scrollToResults();
              }}
            />
          )}
        </div>
      </div>

      <FavoriteCategoryModal
        open={pendingFavorite !== null}
        modelTitle={pendingFavorite?.title ?? null}
        options={categoryPickerOptions}
        onConfirm={confirmFavoriteCategory}
        onCancel={() => setPendingFavorite(null)}
      />

      <ModelPreviewModal
        open={previewModel !== null}
        modelTitle={previewModel?.title ?? null}
        platform={previewModel?.sourcePlatform ?? null}
        externalId={previewModel?.id ?? null}
        onClose={() => setPreviewModel(null)}
      />

      <SaveSearchModal
        open={saveSearchOpen}
        query={query}
        onConfirm={confirmSaveSearch}
        onCancel={() => setSaveSearchOpen(false)}
      />
    </div>
  );
}

function Pagination({
  page,
  hasNext,
  onNavigate,
}: {
  page: number;
  hasNext: boolean;
  onNavigate: (page: number) => void;
}) {
  return (
    <nav
      aria-label="Search result pages"
      className="flex items-center justify-center gap-4 py-2"
    >
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onNavigate(page - 1)}
        className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
        Previous
      </button>
      <span className="text-sm text-zinc-500">Page {page}</span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onNavigate(page + 1)}
        className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-800 py-20 text-center">
      {icon}
      <p className="max-w-md text-sm text-zinc-500">{message}</p>
    </div>
  );
}
