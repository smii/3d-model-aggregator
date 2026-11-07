// Fixtures in this file are synthetic fixtures, not a live recording: they are
// hand-written to match the ThingiverseSearchResponse shape in thingiverse.ts.
import { describe, expect, it, vi } from "vitest";
import { errorResponse, jsonResponse, stubFetch } from "@/test/http";
import { ALL_CATEGORIES } from "@/test/categories";
import { thingiverseAdapter } from "./thingiverse";

const FULL_HIT = {
  id: 763622,
  name: "Articulated Dragon",
  public_url: "https://www.thingiverse.com/thing:763622",
  thumbnail: "https://cdn.example.test/thumb.jpg",
  preview_image: "https://cdn.example.test/preview.jpg",
  like_count: 1234,
  creator: { name: "dragonmaker" },
  tags: [{ name: "dragon" }, { name: "flexi" }],
  license: "Creative Commons - Attribution",
};

const SPARSE_HIT = {
  id: 5,
  name: "Bare Thing",
  public_url: null,
  thumbnail: null,
  preview_image: null,
  like_count: null,
  creator: null,
  tags: null,
  license: null,
};

describe("thingiverseAdapter", () => {
  it("identifies as thingiverse", () => {
    expect(thingiverseAdapter.platform).toBe("thingiverse");
  });

  describe("search", () => {
    it("maps a full hit to a UnifiedModelResult", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      stubFetch(() => jsonResponse({ total: 1, hits: [FULL_HIT] }));

      const results = await thingiverseAdapter.search({ query: "dragon" });

      expect(results).toEqual([
        {
          id: "763622",
          title: "Articulated Dragon",
          sourcePlatform: "thingiverse",
          author: "dragonmaker",
          thumbnailUrl: "https://cdn.example.test/thumb.jpg",
          images: ["https://cdn.example.test/thumb.jpg"],
          externalUrl: "https://www.thingiverse.com/thing:763622",
          likesCount: 1234,
          downloadsCount: 0,
          price: null,
          tags: ["dragon", "flexi"],
          license: "Creative Commons - Attribution",
          isLikedLocally: false,
        },
      ]);
    });

    it("fills defaults for missing optional fields", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      stubFetch(() => jsonResponse({ total: 1, hits: [SPARSE_HIT] }));

      const [result] = await thingiverseAdapter.search({ query: "bare" });

      expect(result).toMatchObject({
        author: "Unknown",
        thumbnailUrl: "",
        images: [],
        externalUrl: "https://www.thingiverse.com/thing:5",
        likesCount: 0,
        tags: [],
        license: "Unknown",
      });
    });

    it("falls back to preview_image when there is no thumbnail", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      stubFetch(() =>
        jsonResponse({ total: 1, hits: [{ ...FULL_HIT, thumbnail: null }] }),
      );

      const [result] = await thingiverseAdapter.search({ query: "dragon" });

      expect(result.thumbnailUrl).toBe("https://cdn.example.test/preview.jpg");
      expect(result.images).toEqual(["https://cdn.example.test/preview.jpg"]);
    });

    it("returns an empty array when there are no hits", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      stubFetch(() => jsonResponse({ total: 0, hits: [] }));

      expect(await thingiverseAdapter.search({ query: "nothing" })).toEqual([]);
    });

    it("sends the query, paging and bearer token to the search endpoint", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      const { calls } = stubFetch(() => jsonResponse({ total: 0, hits: [] }));

      await thingiverseAdapter.search({ query: "a b/c", page: 3, perPage: 7 });

      expect(calls).toHaveLength(1);
      const url = new URL(calls[0].url);
      expect(url.origin + url.pathname).toBe("https://api.thingiverse.com/search/a%20b%2Fc");
      expect(url.searchParams.get("type")).toBe("things");
      expect(url.searchParams.get("page")).toBe("3");
      expect(url.searchParams.get("per_page")).toBe("7");
      expect(calls[0].init.headers).toEqual({ Authorization: "Bearer test-token" });
    });

    it("defaults to page 1 with 20 results", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      const { calls } = stubFetch(() => jsonResponse({ total: 0, hits: [] }));

      await thingiverseAdapter.search({ query: "x" });

      const url = new URL(calls[0].url);
      expect(url.searchParams.get("page")).toBe("1");
      expect(url.searchParams.get("per_page")).toBe("20");
    });

    it("rejects with status and host on an HTTP error", async () => {
      vi.stubEnv("THINGIVERSE_APP_TOKEN", "test-token");
      stubFetch(() => errorResponse(401, "Unauthorized"));

      await expect(thingiverseAdapter.search({ query: "x" })).rejects.toThrow(
        "401 Unauthorized from api.thingiverse.com",
      );
    });

    it("rejects without calling the network when THINGIVERSE_APP_TOKEN is missing", async () => {
      const { stub } = stubFetch(() => jsonResponse({ total: 0, hits: [] }));

      await expect(thingiverseAdapter.search({ query: "x" })).rejects.toThrow(
        "THINGIVERSE_APP_TOKEN is not set",
      );
      expect(stub).not.toHaveBeenCalled();
    });
  });

  describe("supportsCategory", () => {
    it.each(ALL_CATEGORIES)("is not implemented, so %s is unsupported", (category) => {
      expect(thingiverseAdapter.supportsCategory?.(category) ?? false).toBe(false);
    });
  });
});
