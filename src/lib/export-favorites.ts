import type { FavoriteListItem } from "@/components/FavoritesBrowser";

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

export function favoritesToCsv(items: ReadonlyArray<FavoriteListItem>): string {
  const rows = [
    CSV_COLUMNS.map((column) => column.header).join(","),
    ...items.map((item) =>
      CSV_COLUMNS.map((column) => csvCell(column.get(item))).join(",")
    ),
  ];
  return rows.join("\n");
}

export function favoritesToJson(items: ReadonlyArray<FavoriteListItem>): string {
  return JSON.stringify(items, null, 2);
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
