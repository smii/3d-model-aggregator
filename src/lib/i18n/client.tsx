"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import type { MessageKey } from "./messages/en";
import { createT, type TFunction } from "./translate";

// Client-side access to the active locale. The root layout resolves the locale
// on the server and passes that one locale's (already English-merged) messages
// down as props, so no other language is ever bundled for the browser and this
// file never touches cookies or headers.

interface I18nContextValue {
  locale: Locale;
  t: TFunction;
}

// Outside a provider (an isolated render, say) t() returns the key itself
// rather than throwing, which is visibly wrong but never crashes a page.
const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: createT({}),
});

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Partial<Record<MessageKey, string>>;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: createT(messages) }),
    [locale, messages]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `const t = useT();` then `t("nav.search")` in any client component. */
export function useT(): TFunction {
  return useContext(I18nContext).t;
}

/** The active locale code, e.g. for the language switcher's current value. */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
