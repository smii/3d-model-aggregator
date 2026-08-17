"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { MAX_CATEGORY_LENGTH } from "@/lib/category-constants";
import type { FavoriteCategoryOption } from "@/lib/favorite-categories";

const NEW_CATEGORY_VALUE = "__new__";

interface CategoryComboboxProps {
  value: string | null;
  options: ReadonlyArray<FavoriteCategoryOption>;
  onChange: (value: string | null) => void;
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
}

// A <select> of known categories (defaults + previously-used custom ones)
// plus an inline "+ New category" affordance that lets the user type one in
// on the spot. Shared by the favoriting flow and the Favorites page editor.
export function CategoryCombobox({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  autoFocus,
}: CategoryComboboxProps) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

  if (creating) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          maxLength={MAX_CATEGORY_LENGTH}
          autoFocus
          placeholder="New category name…"
          aria-label={`New ${ariaLabel}`}
          className={
            className ??
            "w-full rounded-lg border border-indigo-500/60 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
          }
        />
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0}
          aria-label="Confirm new category"
          className="shrink-0 rounded-lg p-1.5 text-emerald-400 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel new category"
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY_VALUE) {
          setDraft("");
          setCreating(true);
          return;
        }
        onChange(e.target.value === "" ? null : e.target.value);
      }}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      className={
        className ??
        "w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none"
      }
    >
      <option value="">Uncategorized</option>
      {options.map(({ value: optionValue, label }) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
      <option value={NEW_CATEGORY_VALUE}>+ New category…</option>
    </select>
  );

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange(trimmed);
    setCreating(false);
  }

  function cancel() {
    setCreating(false);
    setDraft("");
  }
}
