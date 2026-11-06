"use client";

import { useState } from "react";
import { Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { CollectionNameForm } from "@/components/CollectionNameForm";
import type { CollectionSummary } from "@/lib/collection-names";

// Sidebar radio value: "all" | "none" (favorites in no collection) | a
// collection id
export type CollectionFilter = "all" | "none" | string;

// What the panel is currently asking the user for, if anything.
type PanelMode =
  | { kind: "create" }
  | { kind: "rename"; id: string }
  | { kind: "delete"; id: string }
  | null;

interface CollectionsPanelProps {
  collections: ReadonlyArray<CollectionSummary>;
  // Number of favorites in each collection, keyed by collection id.
  counts: ReadonlyMap<string, number>;
  totalCount: number;
  uncollectedCount: number;
  filter: CollectionFilter;
  onFilterChange: (filter: CollectionFilter) => void;
  // Each of these resolves to an error message to show, or null on success.
  onCreate: (name: string) => Promise<string | null>;
  onRename: (collection: CollectionSummary, name: string) => Promise<string | null>;
  onDelete: (collection: CollectionSummary) => Promise<string | null>;
}

// The "Collections" section of the Favorites sidebar: filter by collection
// (combined with the category and platform filters by FavoritesBrowser) and
// create, rename or delete collections.
export function CollectionsPanel({
  collections,
  counts,
  totalCount,
  uncollectedCount,
  filter,
  onFilterChange,
  onCreate,
  onRename,
  onDelete,
}: CollectionsPanelProps) {
  const [mode, setMode] = useState<PanelMode>(null);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
        <Folder className="size-3.5" />
        Collections
      </h2>

      {collections.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          Group favorites into your own lists, like a project, a material or a
          printer.
        </p>
      ) : (
        // min-w-0: a fieldset otherwise refuses to shrink below its widest label.
        <fieldset className="mt-3 flex min-w-0 flex-col gap-0.5">
          <legend className="sr-only">Filter by collection</legend>
          <CollectionRadio
            label="All favorites"
            count={totalCount}
            checked={filter === "all"}
            onChange={() => onFilterChange("all")}
          />
          <CollectionRadio
            label="Not in a collection"
            count={uncollectedCount}
            checked={filter === "none"}
            onChange={() => onFilterChange("none")}
          />
          {collections.map((collection) => {
            if (mode?.kind === "rename" && mode.id === collection.id) {
              return (
                <CollectionNameForm
                  key={collection.id}
                  initialValue={collection.name}
                  ariaLabel={`New name for collection ${collection.name}`}
                  submitLabel="Save name"
                  onSubmit={(name) => onRename(collection, name)}
                  onClose={() => setMode(null)}
                />
              );
            }
            if (mode?.kind === "delete" && mode.id === collection.id) {
              return (
                <DeleteConfirm
                  key={collection.id}
                  name={collection.name}
                  onConfirm={async () => {
                    const message = await onDelete(collection);
                    if (!message) setMode(null);
                    return message;
                  }}
                  onCancel={() => setMode(null)}
                />
              );
            }
            const checked = filter === collection.id;
            return (
              <div key={collection.id} className="flex items-center gap-0.5">
                <CollectionRadio
                  label={collection.name}
                  count={counts.get(collection.id) ?? 0}
                  checked={checked}
                  onChange={() => onFilterChange(collection.id)}
                />
                {/* Only on the selected row: keeps the narrow sidebar uncluttered. */}
                {checked && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode({ kind: "rename", id: collection.id })}
                      aria-label={`Rename collection ${collection.name}`}
                      className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode({ kind: "delete", id: collection.id })}
                      aria-label={`Delete collection ${collection.name}`}
                      className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-rose-400"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </fieldset>
      )}

      <div className="mt-3">
        {mode?.kind === "create" ? (
          <CollectionNameForm
            placeholder="New collection name…"
            ariaLabel="New collection name"
            submitLabel="Create collection"
            onSubmit={onCreate}
            onClose={() => setMode(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setMode({ kind: "create" })}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            <Plus className="size-4" />
            New collection
          </button>
        )}
      </div>
    </section>
  );
}

function CollectionRadio({
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
      className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-800/60 ${
        checked ? "text-zinc-100" : "text-zinc-400"
      }`}
    >
      <input
        type="radio"
        name="favorites-collection"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-indigo-500"
      />
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      <span className="text-xs text-zinc-500">{count}</span>
    </label>
  );
}

// Deleting asks first because it can't be undone from here. Only the
// grouping goes: the favorites in the collection stay in Favorites.
function DeleteConfirm({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => Promise<string | null>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    let message: string | null;
    try {
      message = await onConfirm();
    } catch {
      message = "Something went wrong. Try again.";
    }
    setBusy(false);
    // On success the parent drops this row, so there is nothing else to do.
    if (message) setError(message);
  }

  return (
    <div
      role="group"
      aria-label={`Delete collection ${name}`}
      className="rounded-lg border border-rose-900/50 bg-rose-950/20 p-2.5 text-xs"
    >
      <p className="break-words text-rose-200">
        Delete &quot;{name}&quot;? The favorites in it are kept.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-md bg-rose-600 px-3 py-1.5 font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
