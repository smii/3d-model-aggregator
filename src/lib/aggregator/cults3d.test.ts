// Fixtures in this file are synthetic fixtures, not a live recording: they are
// hand-written to match the Cults3dSearchResponse shape in cults3d.ts.
import { describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES } from "@/test/categories";
import { errorResponse, jsonResponse, stubFetch } from "@/test/http";
import { cults3dAdapter } from "./cults3d";

function withCredentials() {
  vi.stubEnv("CULTS3D_USERNAME", "tester");
  vi.stubEnv("CULTS3D_API_KEY", "secret-key");
}

const FREE = {
  name: "Benchy Boat",
  shortUrl: "https://cults3d.com/en/3d-model/various/benchy-boat",
  illustrationImageUrl: "https://img.example.test/main.jpg",
  illustrations: [
    { imageUrl: "https://img.example.test/main.jpg" },
    { imageUrl: "https://img.example.test/second.jpg" },
    { imageUrl: null },
  ],
  likesCount: 42,
  downloadsCount: 900,
  openPriced: false,
  price: { cents: 0, currency: "EUR" },
  creator: { nick: "boatmaker" },
};

const PAID = {
  ...FREE,
  name: "Paid Boat",
  shortUrl: "https://cults3d.com/en/3d-model/various/paid-boat",
  price: { cents: 499, currency: "EUR" },
};

const PAY_WHAT_YOU_WANT = { ...PAID, name: "Pay What You Want", openPriced: true };

const SPARSE = {
  name: "Sparse",
  shortUrl: "https://cults3d.com/en/3d-model/various/sparse",
  illustrationImageUrl: null,
  illustrations: null,
  likesCount: null,
  downloadsCount: null,
  openPriced: null,
  price: null,
  creator: null,
};

function respondWith(results: unknown[]) {
  return stubFetch(() => jsonResponse({ data: { creationsSearchBatch: { results } } }));
}

describe("cults3dAdapter", () => {
  it("identifies as cults3d", () => {
    expect(cults3dAdapter.platform).toBe("cults3d");
  });

  describe("search", () => {
    it("maps a free creation to a UnifiedModelResult", async () => {
      withCredentials();
      respondWith([FREE]);

      const results = await cults3dAdapter.search({ query: "benchy" });

      expect(results).toEqual([
        {
          id: FREE.shortUrl,
          title: "Benchy Boat",
          sourcePlatform: "cults3d",
          author: "boatmaker",
          thumbnailUrl: "https://img.example.test/main.jpg",
          // Primary first, then the gallery without the duplicate or null.
          images: ["https://img.example.test/main.jpg", "https://img.example.test/second.jpg"],
          externalUrl: FREE.shortUrl,
          likesCount: 42,
          downloadsCount: 900,
          price: null,
          tags: [],
          license: "Unknown",
          isLikedLocally: false,
        },
      ]);
    });

    it("reports the price of a hard-paywalled creation", async () => {
      withCredentials();
      respondWith([PAID]);

      const [result] = await cults3dAdapter.search({ query: "boat" });

      expect(result.price).toEqual({ cents: 499, currency: "EUR" });
    });

    it("treats pay-what-you-want (openPriced) as free", async () => {
      withCredentials();
      respondWith([PAY_WHAT_YOU_WANT]);

      const [result] = await cults3dAdapter.search({ query: "boat" });

      expect(result.price).toBeNull();
    });

    it("fills defaults for missing optional fields", async () => {
      withCredentials();
      respondWith([SPARSE]);

      const [result] = await cults3dAdapter.search({ query: "sparse" });

      expect(result).toMatchObject({
        author: "Unknown",
        thumbnailUrl: "",
        images: [],
        likesCount: 0,
        downloadsCount: 0,
        price: null,
      });
    });

    it("returns an empty array for no results", async () => {
      withCredentials();
      respondWith([]);

      expect(await cults3dAdapter.search({ query: "nothing" })).toEqual([]);
    });

    it("returns an empty array when data is absent", async () => {
      withCredentials();
      stubFetch(() => jsonResponse({}));

      expect(await cults3dAdapter.search({ query: "x" })).toEqual([]);
    });

    it("rejects with the GraphQL error messages", async () => {
      withCredentials();
      stubFetch(() => jsonResponse({ errors: [{ message: "bad one" }, { message: "bad two" }] }));

      await expect(cults3dAdapter.search({ query: "x" })).rejects.toThrow("bad one; bad two");
    });

    it("posts the query with paging offset and Basic auth", async () => {
      withCredentials();
      const { calls } = respondWith([]);

      await cults3dAdapter.search({ query: "benchy", page: 3, perPage: 10 });

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://cults3d.com/graphql");
      expect(calls[0].init.method).toBe("POST");
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers.Authorization).toBe(
        `Basic ${Buffer.from("tester:secret-key").toString("base64")}`,
      );
      const body = JSON.parse(String(calls[0].init.body));
      expect(body.variables).toEqual({ query: "benchy", limit: 10, offset: 20 });
    });

    it("rejects with status and host on an HTTP error", async () => {
      withCredentials();
      stubFetch(() => errorResponse(401, "Unauthorized"));

      await expect(cults3dAdapter.search({ query: "x" })).rejects.toThrow(
        "401 Unauthorized from cults3d.com",
      );
    });

    it.each([
      ["both credentials", {}],
      ["the API key", { CULTS3D_USERNAME: "tester" }],
      ["the username", { CULTS3D_API_KEY: "secret-key" }],
    ])("rejects without calling the network when %s are missing", async (_label, env) => {
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      const { stub } = respondWith([]);

      await expect(cults3dAdapter.search({ query: "x" })).rejects.toThrow(
        "CULTS3D_USERNAME / CULTS3D_API_KEY are not set",
      );
      expect(stub).not.toHaveBeenCalled();
    });
  });

  describe("supportsCategory", () => {
    it.each(ALL_CATEGORIES)("is not implemented, so %s is unsupported", (category) => {
      expect(cults3dAdapter.supportsCategory?.(category) ?? false).toBe(false);
    });
  });
});
