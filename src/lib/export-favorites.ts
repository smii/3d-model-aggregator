import type { FavoriteListItem } from "@/components/FavoritesBrowser";
import type { CollectionSummary } from "@/lib/collection-names";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS: ReadonlyArray<{
  header: string;
  get: (item: FavoriteListItem) => string | number;
}> = [
  { header: "title", get: (item) => item.title },
  { header: "author", get: (item) => item.author },
  { header: "platform", get: (item) => item.sourcePlatform },
  { header: "category", get: (item) => item.category ?? "" },
  { header: "likes", get: (item) => item.likesCount },
  { header: "url", get: (item) => item.externalUrl },
  { header: "thumbnailUrl", get: (item) => item.thumbnailUrl ?? "" },
];

// Names (not internal ids) of the collections a favorite is in, in the order
// of `collections`. Ids that no collection claims are skipped.
function collectionNamesFor(
  collectionIds: ReadonlyArray<string>,
  collections: ReadonlyArray<CollectionSummary>
): string[] {
  return collections
    .filter((collection) => collectionIds.includes(collection.id))
    .map((collection) => collection.name);
}

// `collections` is every known collection; it is only used to turn the ids on
// each item into names.
export function favoritesToCsv(
  items: ReadonlyArray<FavoriteListItem>,
  collections: ReadonlyArray<CollectionSummary> = []
): string {
  // The collections column goes last so the existing columns keep their
  // positions for anything that reads the CSV by index.
  const rows = [
    [...CSV_COLUMNS.map((column) => column.header), "collections"].join(","),
    ...items.map((item) =>
      [
        ...CSV_COLUMNS.map((column) => csvCell(column.get(item))),
        csvCell(collectionNamesFor(item.collectionIds, collections).join("; ")),
      ].join(",")
    ),
  ];
  return rows.join("\n");
}

export function favoritesToJson(
  items: ReadonlyArray<FavoriteListItem>,
  collections: ReadonlyArray<CollectionSummary> = []
): string {
  return JSON.stringify(
    items.map(({ collectionIds, ...item }) => ({
      ...item,
      collections: collectionNamesFor(collectionIds, collections),
    })),
    null,
    2
  );
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
