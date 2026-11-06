// English catalog: the source of truth for every UI string extracted so far.
// Keys are flat, dot-separated and grouped by area ("nav.*", "auth.*"). A key
// added here is type-checked everywhere through `MessageKey`; other locales
// translate it whenever they get to it and fall back to this text until then.
// See docs/i18n.md for the extraction workflow.
//
// Do not translate brand or platform names (3D Model Aggregator, Printables, ...).

export const en = {
  // Navigation: src/lib/nav-items.ts -> Sidebar, MobileNav; also the user menu
  "nav.search": "Search",
  "nav.favorites": "Favorites",
  "nav.savedSearches": "Saved Searches",
  "nav.accountSync": "Account Sync",
  "nav.settings": "Settings",

  // Header authentication controls
  "auth.signIn": "Sign in with Google",
  "auth.signOut": "Sign out",

  // Language switcher
  "language.label": "Language",
} satisfies Record<string, string>;

export type MessageKey = keyof typeof en;

/** A locale's translations. May be partial: missing keys fall back to English. */
export type Catalog = Partial<Record<MessageKey, string>>;
