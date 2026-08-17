import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  SavedSearchesBrowser,
  type SavedSearchListItem,
} from "@/components/SavedSearchesBrowser";

export const metadata: Metadata = {
  title: "Saved Searches | 3D Model Aggregator",
};

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const searches = await prisma.savedSearch.findMany({
    orderBy: { createdAt: "desc" },
  });

  const items: SavedSearchListItem[] = searches.map((search) => ({
    id: search.id,
    name: search.name,
    query: search.query,
    platforms: search.platforms ? search.platforms.split(",").filter(Boolean) : [],
    category: search.category,
    sort: search.sort,
    newResultsCount: search.newResultsCount,
    lastRunAt: search.lastRunAt?.toISOString() ?? null,
    lastError: search.lastError,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved Searches</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Search + filter combos you&apos;ve saved. A background job re-runs
          them periodically and flags new results here.
        </p>
      </div>

      <SavedSearchesBrowser initialItems={items} />
    </div>
  );
}
