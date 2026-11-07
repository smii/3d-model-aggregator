// Pure and client-safe (no server imports): shared by the /api/collections
// routes and the Favorites UI so both enforce the same naming rules.

export const MAX_COLLECTION_NAME_LENGTH = 60;

// What the client needs to know about a collection. Membership lives on the
// favorites (FavoriteListItem.collectionIds), not here.
export interface CollectionSummary {
  id: string;
  name: string;
}

// Key for case-insensitive uniqueness. SQLite's and PostgreSQL's unique
// indexes are both case-sensitive, so duplicates are caught in code by
// comparing these. toLowerCase (not toLocaleLowerCase) on purpose: the result
// must not depend on the locale of the server or browser doing the comparing.
export function collectionNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function compareCollections(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

export type ParsedCollectionName = { name: string } | { error: string };

// Control characters are rejected too: they have no business in a label, and
// a NUL byte makes PostgreSQL fail the insert with a 500 instead of a 400.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export function parseCollectionName(value: unknown): ParsedCollectionName {
  if (typeof value !== "string") return { error: "Name is required." };
  const name = value.trim();
  if (name.length === 0) return { error: "Name is required." };
  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
    return { error: `Name must be at most ${MAX_COLLECTION_NAME_LENGTH} characters.` };
  }
  if (CONTROL_CHARACTERS.test(name)) {
    return { error: "Name contains invalid characters." };
  }
  return { name };
}
