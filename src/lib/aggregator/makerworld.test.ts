// Fixtures in this file are synthetic fixtures, not a live recording: they are
// hand-written to match the MakerWorldSearchResponse shape in makerworld.ts.
import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES } from "@/test/categories";
import { errorResponse, jsonResponse, stubFetch } from "@/test/http";
import { makerworldAdapter } from "./makerworld";

const HIT = {
  id: 98765,
  title: "Cable Organizer",
  cover: "https://cdn.example.test/cover.jpg",
  designCreator: { name: "organizer_fan" },
  likeCount: 321,
  downloadCount: 4567,
  tags: ["desk", "cable"],
  license: "CC BY-NC",
};

const SPARSE = {
  id: 3,
  title: "Sparse",
  cover: null,
  designCreator: null,
  likeCount: null,
  downloadCount: null,
  tags: null,
  license: null,
};

describe("makerworldAdapter", () => {
  it("identifies as makerworld", () => {
    expect(makerworldAdapter.platform).toBe("makerworld");
  });

  describe("search", () => {
    it("maps a hit to a UnifiedModelResult without needing any credential", async () => {
      stubFetch(() => jsonResponse({ total: 1, hits: [HIT] }));

      const results = await makerworldAdapter.search({ query: "cable" });

      expect(results).toEqual([
        {
          id: "98765",
          title: "Cable Organizer",
          sourcePlatform: "makerworld",
          author: "organizer_fan",
          thumbnailUrl: "https://cdn.example.test/cover.jpg",
          images: ["https://cdn.example.test/cover.jpg"],
          externalUrl: "https://makerworld.com/en/models/98765",
          likesCount: 321,
          downloadsCount: 4567,
          price: null,
          tags: ["desk", "cable"],
          license: "CC BY-NC",
          isLikedLocally: false,
        },
      ]);
    });

    it("fills defaults for missing optional fields", async () => {
      stubFetch(() => jsonResponse({ total: 1, hits: [SPARSE] }));

      const [result] = await makerworldAdapter.search({ query: "sparse" });

      expect(result).toMatchObject({
        author: "Unknown",
        thumbnailUrl: "",
        images: [],
        likesCount: 0,
        downloadsCount: 0,
        tags: [],
        license: "Unknown",
      });
    });

    it("returns an empty array when there are no hits", async () => {
      stubFetch(() => jsonResponse({ total: 0, hits: [] }));

      expect(await makerworldAdapter.search({ query: "nothing" })).toEqual([]);
    });

    it("sends keyword, limit and offset with browser-like headers", async () => {
      const { calls } = stubFetch(() => jsonResponse({ total: 0, hits: [] }));

      await makerworldAdapter.search({ query: "cable organizer", page: 3, perPage: 10 });

      const url = new URL(calls[0].url);
      expect(url.origin + url.pathname).toBe(
        "https://makerworld.com/api/v1/search-service/select/design2",
      );
      expect(url.searchParams.get("keyword")).toBe("cable organizer");
      expect(url.searchParams.get("limit")).toBe("10");
      expect(url.searchParams.get("offset")).toBe("20");
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers["User-Agent"]).toContain("Mozilla/5.0");
    });

    it("rejects with status and host on an HTTP error", async () => {
      stubFetch(() => errorResponse(403, "Forbidden"));

      await expect(makerworldAdapter.search({ query: "x" })).rejects.toThrow(
        "403 Forbidden from makerworld.com",
      );
    });
  });

  describe("supportsCategory", () => {
    it.each(ALL_CATEGORIES)("is not implemented, so %s is unsupported", (category) => {
      expect(makerworldAdapter.supportsCategory?.(category) ?? false).toBe(false);
    });
  });
});
