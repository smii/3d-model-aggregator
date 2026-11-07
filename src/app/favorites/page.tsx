import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  FavoritesBrowser,
  type FavoriteListItem,
} from "@/components/FavoritesBrowser";
import { compareCollections } from "@/lib/collection-names";
import { HIDE_GMAIL_FEATURES } from "@/lib/config";

export const metadata: Metadata = {
  title: "Favorites | 3D Model Aggregator",
};

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const [favorites, collections] = await Promise.all([
    prisma.favoriteModel.findMany({
      orderBy: { createdAt: "desc" },
      include: { collections: { select: { collectionId: true } } },
    }),
    prisma.favoriteCollection.findMany({ select: { id: true, name: true } }),
  ]);

  const items: FavoriteListItem[] = favorites.map((favorite) => ({
    id: favorite.id,
    externalId: favorite.externalId,
    title: favorite.title,
    author: favorite.author,
    externalUrl: favorite.externalUrl,
    thumbnailUrl: favorite.thumbnailUrl,
    sourcePlatform: favorite.sourcePlatform,
    likesCount: favorite.likesCount,
    category: favorite.category,
    collectionIds: favorite.collections.map((membership) => membership.collectionId),
    createdAt: favorite.createdAt.toISOString(),
  }));

  // Alphabetical, like the /api/collections list: the database orders text by
  // byte value, so this is sorted in code.
  const collectionList = collections.sort(compareCollections);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Models you saved from search results, organized by category and
          collection.
        </p>
      </div>

      {!HIDE_GMAIL_FEATURES && (
        <Link
          href="/favorites/likes"
          className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700"
        >
          <span className="flex items-center gap-3 text-sm font-medium text-zinc-100">
            <Heart className="size-4 text-rose-500" />
            Imported likes
          </span>
          <ArrowRight className="size-4 text-zinc-500" />
        </Link>
      )}

      <FavoritesBrowser initialItems={items} initialCollections={collectionList} />
    </div>
  );
}
