import { describe, expect, it } from "vitest";
import { makeResult } from "@/test/factories";
import type { SourcePlatform } from "@/types/model";
import { annotateDuplicates } from "./dedupe";

function titled(platform: SourcePlatform, id: string, title: string) {
  return makeResult({ sourcePlatform: platform, id, title });
}

describe("annotateDuplicates", () => {
  describe("flagging the same model on different platforms", () => {
    it("flags two results whose descriptive words match, in both directions", () => {
      const results = [
        titled("printables", "p1", "Flexi Wyvern Pro Articulated Dragon"),
        titled("thingiverse", "t1", "Articulated Dragon - Flexi Wyvern Pro"),
      ];

      const [first, second] = annotateDuplicates(results, "articulated dragon");

      expect(first.alsoFoundOn).toEqual([{ platform: "thingiverse", id: "t1" }]);
      expect(second.alsoFoundOn).toEqual([{ platform: "printables", id: "p1" }]);
    });

    it("lists every other platform carrying the model, in result order", () => {
      const results = [
        titled("printables", "p1", "Crystal Dragon Egg Holder"),
        titled("thingiverse", "t1", "Crystal Dragon Egg Holder"),
        titled("cults3d", "c1", "Crystal Dragon Egg Holder"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated[0].alsoFoundOn).toEqual([
        { platform: "thingiverse", id: "t1" },
        { platform: "cults3d", id: "c1" },
      ]);
      expect(annotated[1].alsoFoundOn).toEqual([
        { platform: "printables", id: "p1" },
        { platform: "cults3d", id: "c1" },
      ]);
      expect(annotated[2].alsoFoundOn).toEqual([
        { platform: "printables", id: "p1" },
        { platform: "thingiverse", id: "t1" },
      ]);
    });

    it("ignores case, punctuation, stopwords and one-letter words", () => {
      const results = [
        titled("printables", "p1", "The Dragon-Fly: Garden Lantern (v2)!"),
        titled("grabcad", "g1", "dragon fly garden lantern v2"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated[0].alsoFoundOn).toEqual([{ platform: "grabcad", id: "g1" }]);
      expect(annotated[1].alsoFoundOn).toEqual([{ platform: "printables", id: "p1" }]);
    });
  });

  describe("not flagging look-alikes", () => {
    it("does not flag unrelated designs that merely match the same search", () => {
      // The regression this heuristic was tuned against: every result for
      // "dragon" contains "dragon", which must not count as a similarity.
      const results = [
        titled("printables", "p1", "Water Dragon Magnet"),
        titled("thingiverse", "t1", "Skeleton Dragon"),
        titled("cults3d", "c1", "Poison Dragon"),
      ];

      const annotated = annotateDuplicates(results, "dragon");

      expect(annotated.map((r) => r.alsoFoundOn)).toEqual([undefined, undefined, undefined]);
    });

    it("never flags titles that are nothing but the search query", () => {
      const results = [
        titled("grabcad", "g1", "Articulated Dragon"),
        titled("cults3d", "c1", "Articulated Dragon"),
      ];

      const annotated = annotateDuplicates(results, "articulated dragon");

      expect(annotated.map((r) => r.alsoFoundOn)).toEqual([undefined, undefined]);
    });

    it("never flags two results from the same platform", () => {
      const results = [
        titled("printables", "p1", "Crystal Dragon Egg Holder"),
        titled("printables", "p2", "Crystal Dragon Egg Holder"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated.map((r) => r.alsoFoundOn)).toEqual([undefined, undefined]);
    });

    it("has nothing to compare when a title has no latin letters or digits", () => {
      const results = [
        titled("makerworld", "m1", "龍の置物"),
        titled("printables", "p1", "龍の置物"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated.map((r) => r.alsoFoundOn)).toEqual([undefined, undefined]);
    });
  });

  describe("similarity threshold (0.6 Jaccard)", () => {
    // Words are chosen to survive tokenizing (longer than one letter, not
    // stopwords). Jaccard = shared / (words in either title).
    it("flags a pair exactly at 0.6 (3 shared of 5 distinct)", () => {
      const results = [
        titled("printables", "p1", "alpha bravo charlie delta"),
        titled("thingiverse", "t1", "alpha bravo charlie echo"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated[0].alsoFoundOn).toEqual([{ platform: "thingiverse", id: "t1" }]);
    });

    it("does not flag a pair just under 0.6 (4 shared of 7 distinct)", () => {
      const results = [
        titled("printables", "p1", "alpha bravo charlie delta echo"),
        titled("thingiverse", "t1", "alpha bravo charlie delta foxtrot golf"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated.map((r) => r.alsoFoundOn)).toEqual([undefined, undefined]);
    });

    it("flags identical titles (1.0)", () => {
      const results = [
        titled("printables", "p1", "alpha bravo"),
        titled("thingiverse", "t1", "alpha bravo"),
      ];

      expect(annotateDuplicates(results, "")[0].alsoFoundOn).toHaveLength(1);
    });

    it("does not flag titles that share no words", () => {
      const results = [
        titled("printables", "p1", "alpha bravo"),
        titled("thingiverse", "t1", "charlie delta"),
      ];

      expect(annotateDuplicates(results, "").map((r) => r.alsoFoundOn)).toEqual([undefined, undefined]);
    });
  });

  describe("shape of the output", () => {
    it("returns an empty array for no results", () => {
      expect(annotateDuplicates([], "anything")).toEqual([]);
    });

    it("keeps every result, in order, with its fields intact", () => {
      const results = [
        titled("printables", "p1", "alpha bravo"),
        titled("grabcad", "g1", "completely different"),
        titled("thingiverse", "t1", "alpha bravo"),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated.map((r) => r.id)).toEqual(["p1", "g1", "t1"]);
      expect(annotated[1]).toBe(results[1]);
      expect(annotated[0]).toMatchObject({ id: "p1", title: "alpha bravo", sourcePlatform: "printables" });
    });

    it("leaves unflagged results untouched, without an alsoFoundOn key", () => {
      const results = [titled("printables", "p1", "alpha bravo")];

      const [only] = annotateDuplicates(results, "");

      expect(only).toBe(results[0]);
      expect("alsoFoundOn" in only).toBe(false);
    });

    it("does not mutate the input results", () => {
      const results = [
        Object.freeze(titled("printables", "p1", "alpha bravo")),
        Object.freeze(titled("thingiverse", "t1", "alpha bravo")),
      ];

      const annotated = annotateDuplicates(results, "");

      expect(annotated[0]).not.toBe(results[0]);
      expect(results[0].alsoFoundOn).toBeUndefined();
      expect(results[1].alsoFoundOn).toBeUndefined();
    });
  });
});
