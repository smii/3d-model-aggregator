"use client";

import { useEffect } from "react";
import { Heart, X } from "lucide-react";
import { CategoryCombobox } from "@/components/CategoryCombobox";
import type { FavoriteCategoryOption } from "@/lib/favorite-categories";

interface FavoriteCategoryModalProps {
  open: boolean;
  modelTitle: string | null;
  options: ReadonlyArray<FavoriteCategoryOption>;
  onConfirm: (category: string | null) => void;
  onCancel: () => void;
}

// Shown immediately after hitting the heart on a search result, so the
// category gets assigned in the same motion as favoriting instead of a
// separate trip to the Favorites page afterwards.
export function FavoriteCategoryModal({
  open,
  modelTitle,
  options,
  onConfirm,
  onCancel,
}: FavoriteCategoryModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a category"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Heart className="size-5 shrink-0 fill-current text-rose-500" />
            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Saved to favorites
              </h2>
              {modelTitle && (
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {modelTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="size-5" />
          </button>
        </div>

        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-300">Category</span>
          <CategoryCombobox
            value={null}
            options={options}
            onChange={onConfirm}
            ariaLabel="Category"
            autoFocus
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={() => onConfirm(null)}
          className="mt-4 w-full rounded-lg border border-zinc-800 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
        >
          Leave uncategorized
        </button>
      </div>
    </div>
  );
}
