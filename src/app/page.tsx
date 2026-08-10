"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageOpen,
  TriangleAlert,
} from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { SidebarFilters, platformOptions } from "@/components/SidebarFilters";
import { ModelGrid } from "@/components/ModelGrid";
import type {
  ModelCategory,
  SortOption,
  SourcePlatform,
  UnifiedModelResult,
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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<SourcePlatform>>(
    () =>
      new Set(platformOptions.filter((p) => !p.unavailable).map((p) => p.id))
  );
  const [sort, setSort] = useState<SortOption>("newest");
  const [category, setCategory] = useState<ModelCategory | null>(null);
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [page, setPage] = useState(1);
  // Keys ("platform:externalId") of models already in the local favorites
  // database (device-scoped for anonymous visitors, account-scoped when
  // signed in).
  const [savedKeys, setSavedKeys] = useState<ReadonlySet<string>>(new Set());
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/favorites", {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          favorites: { sourcePlatform: string; externalId: string }[];
        };
        setSavedKeys(
          new Set(
            data.favorites.map((f) => `${f.sourcePlatform}:${f.externalId}`)
          )
        );
      } catch {
        // Non-fatal: hearts just start unsaved.
      }
    })();
    return () => controller.abort();
  }, []);

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

  const visibleResults = useMemo(() => {
    if (search.status !== "done") return [];
    const filtered = search.results
      .filter((result) => selected.has(result.sourcePlatform))
      .map((result) => ({
        ...result,
        isLikedLocally: savedKeys.has(
          `${result.sourcePlatform}:${result.id}`
        ),
      }));
    if (sort === "most_liked") {
      return [...filtered].sort((a, b) => b.likesCount - a.likesCount);
    }
    return filtered;
  }, [search, selected, sort, savedKeys]);

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

      <SearchBar value={query} onChange={setQuery} onSubmit={runSearch} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <SidebarFilters
          selectedPlatforms={selected}
          onTogglePlatform={togglePlatform}
          sort={sort}
          onSortChange={setSort}
          category={category}
          onCategoryChange={changeCategory}
        />

        <div className="flex flex-1 flex-col gap-4">
          {saveNotice && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <p>{saveNotice}</p>
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
                <ModelGrid models={visibleResults} onToggleSave={toggleSave} />
                <Pagination
                  page={page}
                  hasNext={search.results.length > 0}
                  onNavigate={(target) => {
                    runSearch(target);
                    window.scrollTo({ top: 0, behavior: "smooth" });
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
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          )}
        </div>
      </div>
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
