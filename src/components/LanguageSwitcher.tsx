"use client";

import { useOptimistic, useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALES, isLocale } from "@/lib/i18n/config";

// Compact header control: icon + short code on screen, a native <select> laid
// invisibly over it. The native picker is what makes this work well on phones
// (full-screen wheel/sheet, large touch target) and on keyboards and screen
// readers, and it scales to any number of locales without extra UI.
export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useT();
  const [pending, startTransition] = useTransition();
  // Shows the choice immediately; reverts to the real locale once the
  // server action has finished and the page has re-rendered.
  const [shownLocale, setShownLocale] = useOptimistic(locale);

  return (
    <div className="relative inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium uppercase text-zinc-400 transition-colors focus-within:ring-2 focus-within:ring-indigo-500 hover:bg-zinc-900 hover:text-zinc-100">
      <Languages aria-hidden="true" className="size-4" />
      <span aria-hidden="true">{shownLocale}</span>
      <select
        aria-label={t("language.label")}
        aria-busy={pending}
        value={shownLocale}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          if (!isLocale(next)) return;
          startTransition(async () => {
            setShownLocale(next);
            try {
              await setLocaleAction(next);
            } catch {
              // Offline or server unreachable: keep the current language. The
              // optimistic value reverts when this transition ends.
            }
          });
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0 [color-scheme:dark]"
      >
        {LOCALES.map(({ code, name }) => (
          <option key={code} value={code} lang={code}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
