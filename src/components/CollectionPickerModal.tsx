"use client";

import { useEffect, useState } from "react";
import { FolderPlus, Plus, X } from "lucide-react";
import { CollectionNameForm } from "@/components/CollectionNameForm";
import type { CollectionSummary } from "@/lib/collection-names";

interface CollectionPickerModalProps {
  favoriteTitle: string;
  collections: ReadonlyArray<CollectionSummary>;
  // Ids of the collections this favorite is currently filed in.
  memberIds: ReadonlyArray<string>;
  // Resolve to an error message to show in the dialog, or null on success.
  onToggle: (collection: CollectionSummary, member: boolean) => Promise<string | null>;
  onCreate: (name: string) => Promise<string | null>;
  onClose: () => void;
}

// Opened from a favorite's card: tick the collections it belongs to, or
// create a new one on the spot. Mounted only while open, so every opening
// starts with fresh local state. The layout follows FavoriteCategoryModal.
export function CollectionPickerModal({
  favoriteTitle,
  collections,
  memberIds,
  onToggle,
  onCreate,
  onClose,
}: CollectionPickerModalProps) {
  // With nothing to pick from yet, go straight to naming the first collection.
  const [creating, setCreating] = useState(collections.length === 0);
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // CollectionNameForm marks the Escape it already used to close itself.
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function toggle(collection: CollectionSummary, member: boolean) {
    if (pending.has(collection.id)) return;
    setError(null);
    setPending((prev) => new Set(prev).add(collection.id));
    const message = await onToggle(collection, member);
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(collection.id);
      return next;
    });
    if (message) setError(message);
  }

  const members = new Set(memberIds);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to collection"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <FolderPlus className="size-5 shrink-0 text-indigo-400" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight">
                Add to collection
              </h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {favoriteTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="size-5" />
          </button>
        </div>

        {collections.length > 0 ? (
          <fieldset className="mt-4 max-h-64 min-w-0 overflow-y-auto rounded-lg border border-zinc-800">
            <legend className="sr-only">Collections</legend>
            {collections.map((collection) => {
              const checked = members.has(collection.id);
              return (
                <label
                  key={collection.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-zinc-800 px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-zinc-900"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pending.has(collection.id)}
                    onChange={(e) => toggle(collection, e.target.checked)}
                    className="size-4 rounded border-zinc-700 accent-indigo-500"
                  />
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      checked ? "text-zinc-100" : "text-zinc-300"
                    }`}
                    title={collection.name}
                  >
                    {collection.name}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No collections yet. Name your first one to group favorites by
            project, material or printer.
          </p>
        )}

        <div className="mt-3">
          {creating ? (
            <CollectionNameForm
              placeholder="New collection name…"
              ariaLabel="New collection name"
              submitLabel="Create collection and add this favorite"
              onSubmit={onCreate}
              onClose={() => setCreating(false)}
              className="min-w-0 flex-1 rounded-lg border border-indigo-500/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
            >
              <Plus className="size-4" />
              New collection
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Done
        </button>
      </div>
    </div>
  );
}
