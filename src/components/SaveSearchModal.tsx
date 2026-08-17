"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

interface SaveSearchModalProps {
  open: boolean;
  query: string;
  onConfirm: (name: string) => Promise<void> | void;
  onCancel: () => void;
}

export function SaveSearchModal({
  open,
  query,
  onConfirm,
  onCancel,
}: SaveSearchModalProps) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setName(query);
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save this search"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-lg shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bell className="size-5 shrink-0 text-indigo-400" />
            <h2 className="text-base font-semibold tracking-tight">
              Save this search
            </h2>
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

        <p className="mt-2 text-xs text-zinc-500">
          A background job periodically re-runs this search (query, selected
          platforms, category, and sort) and flags new results on the Saved
          Searches page.
        </p>

        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="text-zinc-300">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            autoFocus
            maxLength={40}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !name.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
