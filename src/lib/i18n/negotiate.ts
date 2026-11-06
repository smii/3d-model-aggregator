import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

// Pure helpers (no Next.js imports) for mapping untrusted language tags, from
// the NEXT_LOCALE cookie or the Accept-Language header, onto a supported locale.

// Real browsers send well under 200 bytes; cap what we are willing to parse.
const MAX_HEADER_LENGTH = 512;
const MAX_TAGS = 20;

/**
 * Maps a language tag ("es", "es-MX", "ES_mx") onto a supported locale: exact
 * match first (case-insensitive), then by primary subtag. Returns null for
 * anything unsupported or malformed, including "*".
 */
export function matchLocale(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized || normalized === "*") return null;

  const exact = LOCALES.find((locale) => locale.code.toLowerCase() === normalized);
  if (exact) return exact.code;

  const primary = normalized.split("-")[0];
  const byPrimary = LOCALES.find(
    (locale) => locale.code.toLowerCase().split("-")[0] === primary
  );
  return byPrimary?.code ?? null;
}

/**
 * Picks the best supported locale from an Accept-Language header value,
 * honouring q-values ("es;q=0.8" ranks below "en"). Never throws: a missing,
 * oversized or malformed header yields DEFAULT_LOCALE.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .slice(0, MAX_HEADER_LENGTH)
    .split(",")
    .slice(0, MAX_TAGS)
    .map((part, index) => {
      const [tag, ...params] = part.split(";");
      const qParam = params
        .map((param) => param.trim().toLowerCase())
        .find((param) => param.startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0, index };
    })
    // q=0 means "not acceptable"; a malformed q is treated the same way.
    .filter((candidate) => candidate.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of candidates) {
    const locale = matchLocale(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
