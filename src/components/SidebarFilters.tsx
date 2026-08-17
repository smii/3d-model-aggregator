"use client";

import {
  ArrowDownWideNarrow,
  BadgeEuro,
  Copy,
  Scale,
  Shapes,
  SlidersHorizontal,
} from "lucide-react";
import type { ModelCategory, SortOption, SourcePlatform } from "@/types/model";

export const platformOptions: ReadonlyArray<{
  id: SourcePlatform;
  label: string;
  unavailable?: boolean;
}> = [
  { id: "printables", label: "Printables" },
  { id: "thingiverse", label: "Thingiverse" },
  { id: "cults3d", label: "Cults3D" },
  { id: "makerworld", label: "MakerWorld" },
  { id: "thangs", label: "Thangs", unavailable: true },
  { id: "crealitycloud", label: "Creality Cloud", unavailable: true },
  { id: "grabcad", label: "GrabCAD" },
  { id: "myminifactory", label: "MyMiniFactory" },
];

const sortOptions: ReadonlyArray<{ id: SortOption; label: string }> = [
  { id: "newest", label: "Newest" },
  { id: "most_liked", label: "Most Liked" },
  { id: "most_downloaded", label: "Most Downloaded" },
];

export const categoryOptions: ReadonlyArray<{
  id: ModelCategory;
  label: string;
}> = [
  { id: "toys_games", label: "Toys & Games" },
  { id: "art_design", label: "Art & Design" },
  { id: "gadgets", label: "Gadgets" },
  { id: "tools", label: "Tools" },
  { id: "household", label: "Household" },
  { id: "hobby_diy", label: "Hobby & DIY" },
  { id: "fashion", label: "Fashion" },
  { id: "learning", label: "Learning" },
  { id: "miniatures", label: "Tabletop Miniatures" },
  { id: "sports_outdoor", label: "Sports & Outdoor" },
];

interface SidebarFiltersProps {
  selectedPlatforms: ReadonlySet<SourcePlatform>;
  onTogglePlatform: (platform: SourcePlatform) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  category: ModelCategory | null;
  onCategoryChange: (category: ModelCategory | null) => void;
  freeOnly: boolean;
  onFreeOnlyChange: (freeOnly: boolean) => void;
  /** Distinct licenses present in the current results, with counts. */
  licenseOptions: ReadonlyArray<{ license: string; count: number }>;
  license: string | null;
  onLicenseChange: (license: string | null) => void;
  selectedTags: ReadonlySet<string>;
  onClearTag: (tag: string) => void;
  hideDuplicates: boolean;
  onHideDuplicatesChange: (hideDuplicates: boolean) => void;
}

export function SidebarFilters({
  selectedPlatforms,
  onTogglePlatform,
  sort,
  onSortChange,
  category,
  onCategoryChange,
  freeOnly,
  onFreeOnlyChange,
  licenseOptions,
  license,
  onLicenseChange,
  selectedTags,
  onClearTag,
  hideDuplicates,
  onHideDuplicatesChange,
}: SidebarFiltersProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-60">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <SlidersHorizontal className="size-3.5" />
          Platforms
        </h2>
        <fieldset className="mt-3 flex flex-col gap-0.5">
          <legend className="sr-only">Filter by platform</legend>
          {platformOptions.map(({ id, label, unavailable }) => {
            const checked = selectedPlatforms.has(id);
            if (unavailable) {
              return (
                <label
                  key={id}
                  title="Search is blocked by this platform's bot protection"
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-zinc-600"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    className="size-4 rounded border-zinc-800"
                  />
                  {label}
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-zinc-600">
                    n/a
                  </span>
                </label>
              );
            }
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
                  onChange={() => onTogglePlatform(id)}
                  className="size-4 rounded border-zinc-700 accent-indigo-500"
                />
                {label}
              </label>
            );
          })}
        </fieldset>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <Shapes className="size-3.5" />
          Category
        </h2>
        <fieldset className="mt-3 flex flex-col gap-0.5">
          <legend className="sr-only">Filter by category</legend>
          <label
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
              category === null ? "text-zinc-100" : "text-zinc-400"
            }`}
          >
            <input
              type="radio"
              name="category"
              checked={category === null}
              onChange={() => onCategoryChange(null)}
              className="size-4 accent-indigo-500"
            />
            All categories
          </label>
          {categoryOptions.map(({ id, label }) => {
            const active = category === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
                  active ? "text-zinc-100" : "text-zinc-400"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  checked={active}
                  onChange={() => onCategoryChange(id)}
                  className="size-4 accent-indigo-500"
                />
                {label}
              </label>
            );
          })}
        </fieldset>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Only platforms with native category search are included when a
          category is selected.
        </p>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <ArrowDownWideNarrow className="size-3.5" />
          Sort by
        </h2>
        <fieldset className="mt-3 flex flex-col gap-0.5">
          <legend className="sr-only">Sort results</legend>
          {sortOptions.map(({ id, label }) => {
            const active = sort === id;
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
                  active ? "text-zinc-100" : "text-zinc-400"
                }`}
              >
                <input
                  type="radio"
                  name="sort"
                  checked={active}
                  onChange={() => onSortChange(id)}
                  className="size-4 accent-indigo-500"
                />
                {label}
              </label>
            );
          })}
        </fieldset>
        {sort === "most_downloaded" && (
          <p className="mt-3 text-xs leading-relaxed text-zinc-600">
            Thingiverse and MyMiniFactory don&apos;t report download counts in
            search results, so their results sort to the bottom.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <BadgeEuro className="size-3.5" />
          Price
        </h2>
        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/60">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => onFreeOnlyChange(e.target.checked)}
            className="size-4 rounded border-zinc-700 accent-indigo-500"
          />
          Free only
        </label>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Only Cults3D has paid listings among the connected platforms —
          this hides those.
        </p>
      </section>

      {licenseOptions.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <Scale className="size-3.5" />
            License
          </h2>
          <fieldset className="mt-3 flex flex-col gap-0.5">
            <legend className="sr-only">Filter by license</legend>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
                license === null ? "text-zinc-100" : "text-zinc-400"
              }`}
            >
              <input
                type="radio"
                name="license"
                checked={license === null}
                onChange={() => onLicenseChange(null)}
                className="size-4 accent-indigo-500"
              />
              All licenses
            </label>
            {licenseOptions.map(({ license: value, count }) => {
              const active = license === value;
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
                    active ? "text-zinc-100" : "text-zinc-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="license"
                    checked={active}
                    onChange={() => onLicenseChange(value)}
                    className="size-4 accent-indigo-500"
                  />
                  <span className="flex-1 truncate" title={value}>
                    {value}
                  </span>
                  <span className="text-xs text-zinc-500">{count}</span>
                </label>
              );
            })}
          </fieldset>
        </section>
      )}

      {selectedTags.size > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Tags
          </h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[...selectedTags].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onClearTag(tag)}
                className="rounded-md bg-indigo-500/20 px-2 py-1 text-xs text-indigo-300 transition-colors hover:bg-indigo-500/30"
              >
                {tag} ×
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-zinc-600">
            Showing results matching any selected tag. Click a tag chip on a
            result to add it, or here to remove it.
          </p>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          <Copy className="size-3.5" />
          Duplicates
        </h2>
        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800/60">
          <input
            type="checkbox"
            checked={hideDuplicates}
            onChange={(e) => onHideDuplicatesChange(e.target.checked)}
            className="size-4 rounded border-zinc-700 accent-indigo-500"
          />
          Hide likely duplicates
        </label>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Best-effort: groups results with very similar titles across
          platforms and keeps only the most-liked copy.
        </p>
      </section>
    </aside>
  );
}
