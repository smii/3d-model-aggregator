// Fixtures in this file are synthetic fixtures, not a live recording: they are
// hand-written to match the MmfSearchResponse shape in myminifactory.ts (whose
// real response is unverified; the adapter itself says so).
import { describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES } from "@/test/categories";
import { errorResponse, jsonResponse, stubFetch } from "@/test/http";
import { myminifactoryAdapter } from "./myminifactory";

const ITEM = {
  id: 1001,
  name: "Dwarf Warrior",
  url: "https://www.myminifactory.com/object/3d-print-dwarf-warrior-1001",
  images: [
    { thumbnail: { url: "https://img.example.test/1.jpg" }, is_primary: false },
    { thumbnail: null, small: { url: "https://img.example.test/2.jpg" }, is_primary: true },
    { thumbnail: { url: null }, small: { url: null } },
  ],
  designer: { username: "dwarfdesigns", name: "Dwarf Designs" },
  likes: 77,
  tags: ["dwarf", "miniature"],
};

const SPARSE = {
  id: 2,
  name: "Sparse",
  url: null,
  images: null,
  designer: null,
  likes: null,
  tags: null,
};

describe("myminifactoryAdapter", () => {
  it("identifies as myminifactory", () => {
    expect(myminifactoryAdapter.platform).toBe("myminifactory");
  });

  describe("search", () => {
    it("maps an item to a UnifiedModelResult, putting the primary image first", async () => {
      vi.stubEnv("MYMINIFACTORY_API_KEY", "test-key");
      stubFetch(() => jsonResponse({ total_count: 1, items: [ITEM] }));

      const results = await myminifactoryAdapter.search({ query: "dwarf" });

      expect(results).toEqual([
        {
          id: "1001",
          title: "Dwarf Warrior",
          sourcePlatform: "myminifactory",
          author: "Dwarf Designs",
          thumbnailUrl: "https://img.example.test/2.jpg",
          images: ["https://img.example.test/2.jpg", "https://img.example.test/1.jpg"],
          externalUrl: "https://www.myminifactory.com/object/3d-print-dwarf-warrior-1001",
          likesCount: 77,
          downloadsCount: 0,
          price: null,
          tags: ["dwarf", "miniature"],
          license: "Unknown",
          isLikedLocally: false,
        },
      ]);
    });

    it("uses the designer username when there is no display name", async () => {
      vi.stubEnv("MYMINIFACTORY_API_KEY", "test-key");
      stubFetch(() =>
        jsonResponse({
          total_count: 1,
          items: [{ ...ITEM, designer: { username: "dwarfdesigns", name: null } }],
        }),
      );

      const [result] = await myminifactoryAdapter.search({ query: "dwarf" });

      expect(result.author).toBe("dwarfdesigns");
    });

    it("fills defaults for missing optional fields", async () => {
      vi.stubEnv("MYMINIFACTORY_API_KEY", "test-key");
      stubFetch(() => jsonResponse({ total_count: 1, items: [SPARSE] }));

      const [result] = await myminifactoryAdapter.search({ query: "sparse" });

      expect(result).toMatchObject({
        author: "Unknown",
        thumbnailUrl: "",
        images: [],
        externalUrl: "https://www.myminifactory.com/object/3d-print-2",
        likesCount: 0,
        tags: [],
      });
    });

    it("returns an empty array for no items", async () => {
      vi.stubEnv("MYMINIFACTORY_API_KEY", "test-key");
      stubFetch(() => jsonResponse({ total_count: 0, items: [] }));

      expect(await myminifactoryAdapter.search({ query: "nothing" })).toEqual([]);
    });

    it("sends the query, paging and key as URL parameters", async () => {
      vi.stubEnv("MYMINIFACTORY_API_KEY", "test-key");
      const { calls } = stubFetch(() => jsonResponse({ total_count: 0, items: [] }));

      await myminifactoryAdapter.search({ query: "dwarf king", page: 2, perPage: 5 });

      const url = new URL(calls[0].url);
      expect(url.origin + url.pathname).toBe("https://www.myminifactory.com/api/v2/search");
      expect(url.searchParams.get("q")).toBe("dwarf king");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("per_page")).toBe("5");
      expect(url.searchParams.get("key")).toBe("test-key");
    });

    it("rejects with status and host only, never echoing the key, on an HTTP error", async () => {
      vi.stubEnv("MYMINIFACTORY_API_KEY", "test-key");
      stubFetch(() => errorResponse(401, "Unauthorized"));

      const error = await myminifactoryAdapter.search({ query: "x" }).catch((e: Error) => e);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("401 Unauthorized from www.myminifactory.com");
      expect((error as Error).message).not.toContain("test-key");
    });

    it("rejects without calling the network when MYMINIFACTORY_API_KEY is missing", async () => {
      const { stub } = stubFetch(() => jsonResponse({ total_count: 0, items: [] }));

      await expect(myminifactoryAdapter.search({ query: "x" })).rejects.toThrow(
        "MYMINIFACTORY_API_KEY is not set",
      );
      expect(stub).not.toHaveBeenCalled();
    });
  });

  describe("supportsCategory", () => {
    it.each(ALL_CATEGORIES)("is not implemented, so %s is unsupported", (category) => {
      expect(myminifactoryAdapter.supportsCategory?.(category) ?? false).toBe(false);
    });
  });
});
