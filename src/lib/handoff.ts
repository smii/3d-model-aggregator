import type { SourcePlatform } from "@/types/model";

/**
 * "Also search on" hand-off links for platforms this app cannot search itself.
 *
 * Thangs and Creality Cloud sit behind bot protection that blocks server-side
 * search (see CLAUDE.md), so they have no adapters. Instead the UI links the
 * user's own browser to each platform's search page with the query pre-filled.
 * This module only builds URLs. It must never fetch them, and nothing on the
 * server may request these sites.
 *
 * `verified` is true only once the search-URL pattern has been confirmed
 * against the platform (each entry's `note` says what was and was not
 * checked). While it is false, links go to the site root instead of an
 * unconfirmed search URL, so a wrong guess can never produce a broken deep link.
 */
export interface HandoffEntry {
  platform: SourcePlatform;
  label: string;
  /** Site root: where the link points while `verified` is false. */
  homeUrl: string;
  /** The platform's own search page with `query` pre-filled and URL-encoded. */
  searchUrl: (query: string) => string;
  verified: boolean;
  /** Evidence behind `verified`. */
  note: string;
}

export const HANDOFF_PLATFORMS: ReadonlyArray<HandoffEntry> = [
  {
    platform: "thangs",
    label: "Thangs",
    homeUrl: "https://thangs.com/",
    searchUrl: (query) =>
      `https://thangs.com/search/${encodeURIComponent(query)}`,
    verified: true,
    note:
      "Confirmed by loading /search/<term> (a server-rendered results page), " +
      "including a term containing '/' sent as %2F. Thangs' own trending-search " +
      "links use the same shape; the ?q= form is wrong.",
  },
  {
    platform: "crealitycloud",
    label: "Creality Cloud",
    homeUrl: "https://www.crealitycloud.com/",
    searchUrl: (query) =>
      `https://www.crealitycloud.com/search/models?q=${encodeURIComponent(query)}`,
    verified: true,
    note:
      "Taken from the site's own public client code (its search box navigates " +
      "to /search/models and the results tab reads the term from `q`) and " +
      "matched by an independent open-source integration " +
      "(github.com/noubar/tridiJump). NOT loaded live: robots.txt disallows " +
      "*/search, so it was never requested. Confirm once by hand; set " +
      "verified to false to fall back to the home page.",
  },
];

/** The URL an entry's link should open for `query`. */
export function resolveHandoffUrl(entry: HandoffEntry, query: string): string {
  if (!entry.verified) return entry.homeUrl;
  try {
    return entry.searchUrl(query);
  } catch {
    // encodeURIComponent throws a URIError on lone surrogates (a broken
    // paste, say). Degrade to the site root rather than crash the page.
    return entry.homeUrl;
  }
}

export interface HandoffLink {
  platform: SourcePlatform;
  label: string;
  href: string;
  /** False when the link only opens the site root (pattern unverified). */
  prefilled: boolean;
}

/** Hand-off links for `query`; empty when the query is blank. */
export function getHandoffLinks(query: string): HandoffLink[] {
  const q = query.trim();
  if (!q) return [];
  return HANDOFF_PLATFORMS.map((entry) => {
    const href = resolveHandoffUrl(entry, q);
    return {
      platform: entry.platform,
      label: entry.label,
      href,
      prefilled: href !== entry.homeUrl,
    };
  });
}
