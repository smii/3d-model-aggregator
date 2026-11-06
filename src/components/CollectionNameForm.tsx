"use client";

import { useId, useState } from "react";
import { Check, X } from "lucide-react";
import {
  MAX_COLLECTION_NAME_LENGTH,
  parseCollectionName,
} from "@/lib/collection-names";

interface CollectionNameFormProps {
  initialValue?: string;
  placeholder?: string;
  // Accessible name of the text field.
  ariaLabel: string;
  // Accessible name of the confirm button.
  submitLabel: string;
  // Resolves to a message to show under the field, or null once the name was
  // accepted (the form then closes itself through onClose).
  onSubmit: (name: string) => Promise<string | null>;
  onClose: () => void;
  // Overrides the input styling, like CategoryCombobox's className.
  className?: string;
}

// Inline "type a name, confirm or cancel" row, shared by creating and
// renaming collections. Same interaction as the new-category input in
// CategoryCombobox: Enter confirms, Escape cancels.
export function CollectionNameForm({
  initialValue = "",
  placeholder,
  ariaLabel,
  submitLabel,
  onSubmit,
  onClose,
  className,
}: CollectionNameFormProps) {
  const [draft, setDraft] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const errorId = useId();

  async function submit() {
    if (submitting) return;
    // Same rules as the API, so the common mistakes are caught without a round trip.
    const parsed = parseCollectionName(draft);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSubmitting(true);
    let message: string | null;
    try {
      message = await onSubmit(parsed.name);
    } catch {
      message = "Something went wrong. Try again.";
    }
    setSubmitting(false);
    if (message) {
      setError(message);
    } else {
      onClose();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              // Close just this form, not a dialog it may sit in: React
              // listens on the document, so a dialog's own Escape handler
              // can't be stopped with stopPropagation and checks
              // defaultPrevented instead.
              e.preventDefault();
              onClose();
            }
          }}
          onFocus={(e) => e.currentTarget.select()}
          readOnly={submitting}
          maxLength={MAX_COLLECTION_NAME_LENGTH}
          autoFocus
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={
            className ??
            "min-w-0 flex-1 rounded-lg border border-indigo-500/60 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
          }
        />
        <button
          type="button"
          onClick={submit}
          disabled={submitting || draft.trim().length === 0}
          aria-label={submitLabel}
          className="shrink-0 rounded-lg p-1.5 text-emerald-400 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
