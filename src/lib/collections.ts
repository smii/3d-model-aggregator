// Server-only helpers for the /api/collections routes. The client-safe naming
// rules live in collection-names.ts; don't import this file from a component.
import { prisma } from "@/lib/db";
import { collectionNameKey, compareCollections } from "@/lib/collection-names";

// Local, installation-wide favorite collections -- deliberately
// unauthenticated and not tied to a user, same convention as /api/favorites.

// Shared by the create (POST) and rename (PATCH) routes.
export const NAME_TAKEN_ERROR = "A collection with that name already exists.";

export interface CollectionItem {
  id: string;
  name: string;
  // Ids of the favorites filed in this collection.
  favoriteIds: string[];
  createdAt: string;
  updatedAt: string;
}

// Prisma `include` that pulls in a collection's memberships. Shared so every
// route returns the same shape.
export const collectionInclude = {
  items: { select: { favoriteId: true }, orderBy: { createdAt: "asc" as const } },
};

export function toCollectionItem(collection: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  items: { favoriteId: string }[];
}): CollectionItem {
  return {
    id: collection.id,
    name: collection.name,
    favoriteIds: collection.items.map((item) => item.favoriteId),
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

// Alphabetical, case-insensitive. Sorted in code because the database orders
// text by byte value (uppercase before lowercase).
export async function listCollections(): Promise<CollectionItem[]> {
  const collections = await prisma.favoriteCollection.findMany({
    include: collectionInclude,
  });
  return collections.map(toCollectionItem).sort(compareCollections);
}

// Case-insensitive duplicate check against every other collection. Collections
// are few, so reading all the names is cheaper than anything cleverer and
// works on SQLite and PostgreSQL alike (Prisma's `mode: "insensitive"` is
// PostgreSQL-only).
export async function hasCollectionNameConflict(
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const key = collectionNameKey(name);
  const collections = await prisma.favoriteCollection.findMany({
    select: { id: true, name: true },
  });
  return collections.some(
    (collection) =>
      collection.id !== excludeId && collectionNameKey(collection.name) === key,
  );
}

// Prisma error codes this feature handles: P2002 unique constraint, P2003
// foreign key constraint, P2025 record not found. Checked structurally so a
// request that races another one maps to the right status instead of a 500.
export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
