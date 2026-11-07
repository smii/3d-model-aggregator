// Fixtures in this file are synthetic fixtures, not a live recording: they are
// hand-written to match the PrintablesSearchResponse shape in printables.ts.
import { describe, expect, it } from "vitest";
import { ALL_CATEGORIES } from "@/test/categories";
import { errorResponse, jsonResponse, stubFetch } from "@/test/http";
import { printablesAdapter } from "./printables";

const ITEM = {
  id: "123456",
  name: "Phone Stand",
  slug: "phone-stand",
  likesCount: 88,
  downloadCount: 2000,
  image: { filePath: "media/prints/123456/main.jpg" },
  images: [
    { filePath: "media/prints/123456/main.jpg" },
    { filePath: "media/prints/123456/side.jpg" },
    { filePath: null },
  ],
  user: { publicUsername: "standmaker" },
  license: { name: "CC BY" },
  tags: [{ name: "phone" }, { name: "stand" }],
};

const SPARSE = {
  id: "9",
  name: "Sparse",
  slug: "sparse",
  likesCount: null,
  downloadCount: null,
  image: null,
  images: null,
  user: null,
  license: null,
  tags: null,
};

function respondWith(items: unknown[]) {
  return stubFetch(() => jsonResponse({ data: { result: { items } } }));
}

describe("printablesAdapter", () => {
  it("identifies as printables", () => {
    expect(printablesAdapter.platform).toBe("printables");
  });

  describe("search", () => {
    it("maps an item to a UnifiedModelResult without needing any credential", async () => {
      respondWith([ITEM]);

      const results = await printablesAdapter.search({ query: "phone" });

      expect(results).toEqual([
        {
          id: "123456",
          title: "Phone Stand",
          sourcePlatform: "printables",
          author: "standmaker",
          thumbnailUrl: "https://media.printables.com/media/prints/123456/main.jpg",
          // Primary first, duplicate and null gallery entries dropped.
          images: [
            "https://media.printables.com/media/prints/123456/main.jpg",
            "https://media.printables.com/media/prints/123456/side.jpg",
          ],
          externalUrl: "https://www.printables.com/model/123456-phone-stand",
          likesCount: 88,
          downloadsCount: 2000,
          price: null,
          tags: ["phone", "stand"],
          license: "CC BY",
          isLikedLocally: false,
        },
      ]);
    });

    it("fills defaults for missing optional fields", async () => {
      respondWith([SPARSE]);

      const [result] = await printablesAdapter.search({ query: "sparse" });

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

    it("returns an empty array for no items", async () => {
      respondWith([]);

      expect(await printablesAdapter.search({ query: "nothing" })).toEqual([]);
    });

    it("returns an empty array when data is absent", async () => {
      stubFetch(() => jsonResponse({}));

      expect(await printablesAdapter.search({ query: "x" })).toEqual([]);
    });

    it("rejects with the GraphQL error messages", async () => {
      stubFetch(() => jsonResponse({ errors: [{ message: "nope" }, { message: "again" }] }));

      await expect(printablesAdapter.search({ query: "x" })).rejects.toThrow("nope; again");
    });

    it("posts the query with paging offset and no category by default", async () => {
      const { calls } = respondWith([]);

      await printablesAdapter.search({ query: "phone", page: 3, perPage: 10 });

      expect(calls[0].url).toBe("https://api.printables.com/graphql/");
      expect(calls[0].init.method).toBe("POST");
      const body = JSON.parse(String(calls[0].init.body));
      expect(body.operationName).toBe("SearchModels");
      expect(body.variables).toEqual({ query: "phone", limit: 10, offset: 20, categoryId: null });
    });

    it("sends the Printables category node id when a category is given", async () => {
      const { calls } = respondWith([]);

      await printablesAdapter.search({ query: "phone", category: "miniatures" });

      expect(JSON.parse(String(calls[0].init.body)).variables.categoryId).toBe(101);
    });

    it("rejects with status and host on an HTTP error", async () => {
      stubFetch(() => errorResponse(500, "Internal Server Error"));

      await expect(printablesAdapter.search({ query: "x" })).rejects.toThrow(
        "500 Internal Server Error from api.printables.com",
      );
    });
  });

  describe("supportsCategory", () => {
    it.each(ALL_CATEGORIES)("supports %s natively", (category) => {
      expect(printablesAdapter.supportsCategory?.(category)).toBe(true);
    });
  });
});
