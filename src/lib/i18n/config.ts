// Client-safe i18n constants. Keep this module free of next/headers and of the
// catalogs: the language switcher (a client component) imports LOCALES from here.

/**
 * Supported UI locales, the single source of truth. `Locale`, `isLocale`, the
 * language switcher and the catalog registry (catalogs.ts) all derive from it,
 * so a locale added here but not registered there is a type error.
 * `name` is the endonym shown in the switcher and is never translated.
 */
export const LOCALES = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

/** Shown when nothing else matches, and the fallback for any missing key. */
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the user's explicit choice (the name Next.js i18n routing uses). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** One year, in seconds. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && LOCALES.some((locale) => locale.code === value)
  );
}
