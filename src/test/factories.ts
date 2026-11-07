import type { UnifiedModelResult } from "@/types/model";

/**
 * Build a UnifiedModelResult for tests. Most tests only care about identity
 * (platform + id) or one or two fields; everything else gets a harmless,
 * internally consistent default. Overrides win over every default.
 */
export function makeResult(
  overrides: Partial<UnifiedModelResult> = {},
): UnifiedModelResult {
  const id = overrides.id ?? "1";
  const platform = overrides.sourcePlatform ?? "printables";
  const thumbnailUrl =
    overrides.thumbnailUrl ?? `https://img.example.test/${platform}/${id}.jpg`;

  return {
    id,
    title: `Model ${id}`,
    sourcePlatform: platform,
    author: "tester",
    thumbnailUrl,
    images: [thumbnailUrl],
    externalUrl: `https://${platform}.example.test/model/${id}`,
    likesCount: 0,
    downloadsCount: 0,
    price: null,
    tags: [],
    license: "",
    isLikedLocally: false,
    ...overrides,
  };
}
