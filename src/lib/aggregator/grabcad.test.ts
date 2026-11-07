// Fixtures in this file are synthetic fixtures, not a live recording: they are
// hand-written to match the GrabCadSearchResponse shape in grabcad.ts.
import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES } from "@/test/categories";
import { errorResponse, jsonResponse, stubFetch } from "@/test/http";
import type { ModelCategory } from "@/types/model";
import { grabcadAdapter } from "./grabcad";

const MODEL = {
  name: "Planetary Gearbox",
  cached_slug: "planetary-gearbox-1",
  preview_image: "https://cdn.example.test/gearbox.jpg",
  likes_count: 55,
  downloads_count: 1200,
  author: { name: "gearhead" },
};

const SPARSE = {
  name: "Sparse",
  cached_slug: "sparse-2",
  preview_image: null,
  likes_count: null,
  downloads_count: null,
  author: null,
};

// Categories GrabCAD can filter natively, and the slug it is sent as.
const SUPPORTED: Partial<Record<ModelCategory, string>> = {
  toys_games: "toys",
  gadgets: "tech",
  tools: "tools",
  household: "household",
  hobby_diy: "hobby",
  learning: "educational",
  sports_outdoor: "sport",
};

describe("grabcadAdapter", () => {
  it("identifies as grabcad", () => {
    expect(grabcadAdapter.platform).toBe("grabcad");
  });

  describe("search", () => {
    it("maps a model to a UnifiedModelResult without needing any credential", async () => {
      stubFetch(() => jsonResponse({ total_entries: 1, models: [MODEL] }));

      const results = await grabcadAdapter.search({ query: "gearbox" });

      expect(results).toEqual([
        {
          id: "planetary-gearbox-1",
          title: "Planetary Gearbox",
          sourcePlatform: "grabcad",
          author: "gearhead",
          thumbnailUrl: "https://cdn.example.test/gearbox.jpg",
          images: ["https://cdn.example.test/gearbox.jpg"],
          externalUrl: "https://grabcad.com/library/planetary-gearbox-1",
          likesCount: 55,
          downloadsCount: 1200,
          price: null,
          tags: [],
          license: "Unknown",
          isLikedLocally: false,
        },
      ]);
    });

    it("fills defaults for missing optional fields", async () => {
      stubFetch(() => jsonResponse({ total_entries: 1, models: [SPARSE] }));

      const [result] = await grabcadAdapter.search({ query: "sparse" });

      expect(result).toMatchObject({
        author: "Unknown",
        thumbnailUrl: "",
        images: [],
        likesCount: 0,
        downloadsCount: 0,
      });
    });

    it("returns an empty array when there are no models", async () => {
      stubFetch(() => jsonResponse({ total_entries: 0, models: [] }));

      expect(await grabcadAdapter.search({ query: "nothing" })).toEqual([]);
    });

    it("sends query, page and sort, with no category filter by default", async () => {
      const { calls } = stubFetch(() => jsonResponse({ total_entries: 0, models: [] }));

      await grabcadAdapter.search({ query: "gear box", page: 2 });

      const url = new URL(calls[0].url);
      expect(url.origin + url.pathname).toBe("https://grabcad.com/community/api/v1/models");
      expect(url.searchParams.get("query")).toBe("gear box");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("sort")).toBe("popularity");
      expect(url.searchParams.has("categories")).toBe(false);
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers["User-Agent"]).toContain("Mozilla/5.0");
    });

    it.each(Object.entries(SUPPORTED))("sends the %s category as slug %s", async (category, slug) => {
      const { calls } = stubFetch(() => jsonResponse({ total_entries: 0, models: [] }));

      await grabcadAdapter.search({ query: "x", category: category as ModelCategory });

      expect(new URL(calls[0].url).searchParams.get("categories")).toBe(slug);
    });

    it("rejects with status and host on an HTTP error", async () => {
      stubFetch(() => errorResponse(403, "Forbidden"));

      await expect(grabcadAdapter.search({ query: "x" })).rejects.toThrow(
        "403 Forbidden from grabcad.com",
      );
    });
  });

  describe("supportsCategory", () => {
    it.each(ALL_CATEGORIES)("answers for %s according to the slug table", (category) => {
      expect(grabcadAdapter.supportsCategory?.(category)).toBe(category in SUPPORTED);
    });

    it("does not support art_design, fashion or miniatures", () => {
      for (const category of ["art_design", "fashion", "miniatures"] as const) {
        expect(grabcadAdapter.supportsCategory?.(category)).toBe(false);
      }
    });
  });
});
