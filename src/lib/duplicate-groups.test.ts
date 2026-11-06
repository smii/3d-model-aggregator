import { describe, expect, it } from "vitest";
import { makeResult } from "@/test/factories";
import type { SourcePlatform, UnifiedModelResult } from "@/types/model";
import { mergeDuplicateGroups } from "./duplicate-groups";

type Ref = { platform: SourcePlatform; id: string };

function ref(result: UnifiedModelResult): Ref {
  return { platform: result.sourcePlatform, id: result.id };
}

/** Flag `result` as also found on each of `others`, as annotateDuplicates would. */
function alsoOn(result: UnifiedModelResult, ...others: UnifiedModelResult[]): UnifiedModelResult {
  return { ...result, alsoFoundOn: others.map(ref) };
}

function make(
  platform: SourcePlatform,
  id: string,
  overrides: Partial<UnifiedModelResult> = {},
): UnifiedModelResult {
  return makeResult({ sourcePlatform: platform, id, title: `Model ${platform} ${id}`, ...overrides });
}

describe("mergeDuplicateGroups", () => {
  it("returns an empty array for no results", () => {
    expect(mergeDuplicateGroups([])).toEqual([]);
  });

  it("passes unflagged results through unchanged and in order", () => {
    const a = make("printables", "1");
    const b = make("thingiverse", "2");
    const c = make("grabcad", "3");

    const merged = mergeDuplicateGroups([a, b, c]);

    expect(merged).toHaveLength(3);
    expect(merged[0]).toBe(a);
    expect(merged[1]).toBe(b);
    expect(merged[2]).toBe(c);
  });

  describe("merging a flagged pair", () => {
    const printables = make("printables", "p1", {
      likesCount: 10,
      downloadsCount: 900,
      images: ["p-1.jpg", "shared.jpg"],
      tags: ["dragon", "flexi"],
      externalUrl: "https://printables.example.test/p1",
    });
    const thingiverse = make("thingiverse", "t1", {
      likesCount: 50,
      downloadsCount: 20,
      images: ["t-1.jpg", "shared.jpg"],
      tags: ["flexi", "articulated"],
      externalUrl: "https://thingiverse.example.test/t1",
      isLikedLocally: true,
    });

    function merged() {
      return mergeDuplicateGroups([
        alsoOn(printables, thingiverse),
        alsoOn(thingiverse, printables),
      ]);
    }

    it("folds the pair into one card", () => {
      expect(merged()).toHaveLength(1);
    });

    it("takes identity fields from the most-liked copy", () => {
      const [card] = merged();

      expect(card).toMatchObject({
        id: "t1",
        sourcePlatform: "thingiverse",
        title: "Model thingiverse t1",
        externalUrl: "https://thingiverse.example.test/t1",
      });
    });

    it("lists every platform copy, own platform included, most-liked first", () => {
      const [card] = merged();

      expect(card.mergedPlatforms).toEqual([
        {
          platform: "thingiverse",
          id: "t1",
          externalUrl: "https://thingiverse.example.test/t1",
          likesCount: 50,
          downloadsCount: 20,
          price: null,
        },
        {
          platform: "printables",
          id: "p1",
          externalUrl: "https://printables.example.test/p1",
          likesCount: 10,
          downloadsCount: 900,
          price: null,
        },
      ]);
    });

    it("takes the highest likes and downloads independently of the primary", () => {
      const [card] = merged();

      expect(card.likesCount).toBe(50);
      expect(card.downloadsCount).toBe(900);
    });

    it("unions images (primary's first) and tags without duplicates", () => {
      const [card] = merged();

      expect(card.images).toEqual(["t-1.jpg", "shared.jpg", "p-1.jpg"]);
      expect(card.tags).toEqual(["flexi", "articulated", "dragon"]);
    });

    it("is liked locally if any copy is", () => {
      expect(merged()[0].isLikedLocally).toBe(true);
    });

    it("clears alsoFoundOn on the merged card", () => {
      expect(merged()[0].alsoFoundOn).toBeUndefined();
    });
  });

  describe("price of a merged card", () => {
    const free = make("printables", "p1", { likesCount: 1, price: null });
    const paidCheap = make("cults3d", "c1", { likesCount: 2, price: { cents: 300, currency: "EUR" } });
    const paidDear = make("myminifactory", "m1", { likesCount: 3, price: { cents: 900, currency: "EUR" } });

    it("is free if any copy is free", () => {
      const [card] = mergeDuplicateGroups([
        alsoOn(free, paidCheap, paidDear),
        alsoOn(paidCheap, free),
        alsoOn(paidDear, free),
      ]);

      expect(card.price).toBeNull();
    });

    it("is the cheapest listed price when every copy is paid", () => {
      const [card] = mergeDuplicateGroups([alsoOn(paidDear, paidCheap), alsoOn(paidCheap, paidDear)]);

      expect(card.price).toEqual({ cents: 300, currency: "EUR" });
    });
  });

  describe("grouping", () => {
    it("merges a chain A~B, B~C even though A and C were never flagged together", () => {
      const a = make("printables", "a", { likesCount: 1 });
      const b = make("thingiverse", "b", { likesCount: 2 });
      const c = make("grabcad", "c", { likesCount: 3 });

      const cards = mergeDuplicateGroups([alsoOn(a, b), alsoOn(b, a, c), alsoOn(c, b)]);

      expect(cards).toHaveLength(1);
      expect(cards[0].mergedPlatforms?.map((p) => p.id)).toEqual(["c", "b", "a"]);
    });

    it("merges when only one side of the pair is flagged", () => {
      const a = make("printables", "a", { likesCount: 1 });
      const b = make("thingiverse", "b", { likesCount: 2 });

      const cards = mergeDuplicateGroups([alsoOn(a, b), b]);

      expect(cards).toHaveLength(1);
      expect(cards[0].id).toBe("b");
    });

    it("keeps unrelated groups separate", () => {
      const a1 = make("printables", "a1");
      const a2 = make("thingiverse", "a2");
      const b1 = make("grabcad", "b1");
      const b2 = make("cults3d", "b2");

      const cards = mergeDuplicateGroups([alsoOn(a1, a2), alsoOn(a2, a1), alsoOn(b1, b2), alsoOn(b2, b1)]);

      expect(cards).toHaveLength(2);
      expect(cards.map((c) => c.mergedPlatforms?.length)).toEqual([2, 2]);
    });

    it("ignores a flagged match that is no longer in the result set", () => {
      const a = make("printables", "a");
      const gone = make("thingiverse", "gone");
      const flagged = alsoOn(a, gone);

      const cards = mergeDuplicateGroups([flagged]);

      expect(cards).toHaveLength(1);
      expect(cards[0]).toBe(flagged);
      expect(cards[0].mergedPlatforms).toBeUndefined();
    });

    it("puts the merged card where the group's first member appeared", () => {
      const a = make("printables", "a", { likesCount: 1 });
      const other = make("grabcad", "other");
      const b = make("thingiverse", "b", { likesCount: 2 });
      const last = make("cults3d", "last");

      const cards = mergeDuplicateGroups([alsoOn(a, b), other, alsoOn(b, a), last]);

      expect(cards.map((c) => c.id)).toEqual(["b", "other", "last"]);
    });

    it("breaks a likes tie in favour of the earlier result", () => {
      const a = make("printables", "a", { likesCount: 5 });
      const b = make("thingiverse", "b", { likesCount: 5 });

      const [card] = mergeDuplicateGroups([alsoOn(a, b), alsoOn(b, a)]);

      expect(card.id).toBe("a");
      expect(card.mergedPlatforms?.map((p) => p.id)).toEqual(["a", "b"]);
    });
  });

  describe("caps", () => {
    it("keeps at most 24 images", () => {
      const a = make("printables", "a", {
        likesCount: 2,
        images: Array.from({ length: 20 }, (_, i) => `a-${i}.jpg`),
      });
      const b = make("thingiverse", "b", {
        likesCount: 1,
        images: Array.from({ length: 20 }, (_, i) => `b-${i}.jpg`),
      });

      const [card] = mergeDuplicateGroups([alsoOn(a, b), alsoOn(b, a)]);

      expect(card.images).toHaveLength(24);
      expect(card.images.slice(0, 20)).toEqual(a.images);
      expect(card.images[20]).toBe("b-0.jpg");
    });

    it("keeps at most 20 tags", () => {
      const a = make("printables", "a", {
        likesCount: 2,
        tags: Array.from({ length: 15 }, (_, i) => `a-tag-${i}`),
      });
      const b = make("thingiverse", "b", {
        likesCount: 1,
        tags: Array.from({ length: 15 }, (_, i) => `b-tag-${i}`),
      });

      const [card] = mergeDuplicateGroups([alsoOn(a, b), alsoOn(b, a)]);

      expect(card.tags).toHaveLength(20);
      expect(card.tags.slice(0, 15)).toEqual(a.tags);
    });
  });

  it("does not modify the results it is given", () => {
    const a = Object.freeze(alsoOn(make("printables", "a", { tags: ["x"] }), make("thingiverse", "b")));
    const b = Object.freeze(alsoOn(make("thingiverse", "b", { tags: ["y"] }), make("printables", "a")));
    const input = Object.freeze([a, b]);

    const [card] = mergeDuplicateGroups(input);

    expect(card.mergedPlatforms).toHaveLength(2);
    expect(a.mergedPlatforms).toBeUndefined();
    expect(a.alsoFoundOn).toEqual([{ platform: "thingiverse", id: "b" }]);
    expect(input).toHaveLength(2);
  });
});
