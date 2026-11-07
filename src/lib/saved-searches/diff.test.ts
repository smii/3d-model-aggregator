import { describe, expect, it } from "vitest";
import type { SourcePlatform } from "@/types/model";
import { MAX_TRACKED_KEYS, diffSavedSearchResults } from "./diff";

const EARLIER = new Date("2026-02-01T00:00:00.000Z");

function item(platform: SourcePlatform, id: string) {
  return { sourcePlatform: platform, id };
}

function printables(count: number) {
  return Array.from({ length: count }, (_, i) => item("printables", String(i)));
}

describe("diffSavedSearchResults", () => {
  describe("first-ever run (lastRunAt null)", () => {
    it("establishes the baseline: nothing is new, every key is stored", () => {
      const diff = diffSavedSearchResults(
        [item("printables", "1"), item("thingiverse", "2")],
        { lastSeenIds: "", lastRunAt: null },
      );

      expect(diff).toEqual({ newCount: 0, lastSeenIds: "printables:1,thingiverse:2" });
    });

    it("still reports nothing as new when stale ids are stored", () => {
      const diff = diffSavedSearchResults([item("printables", "1")], {
        lastSeenIds: "printables:9",
        lastRunAt: null,
      });

      expect(diff.newCount).toBe(0);
      expect(diff.lastSeenIds).toBe("printables:1");
    });
  });

  describe("later runs", () => {
    it("counts results whose key was not stored last time", () => {
      const diff = diffSavedSearchResults(
        [
          item("printables", "1"),
          item("thingiverse", "2"),
          item("makerworld", "3"),
          item("cults3d", "4"),
        ],
        { lastSeenIds: "printables:1,thingiverse:2", lastRunAt: EARLIER },
      );

      expect(diff.newCount).toBe(2);
    });

    it("stores the current keys in result order, forgetting the old list", () => {
      const diff = diffSavedSearchResults(
        [item("printables", "2"), item("printables", "7"), item("printables", "1")],
        { lastSeenIds: "printables:1,printables:2,printables:99", lastRunAt: EARLIER },
      );

      expect(diff.lastSeenIds).toBe("printables:2,printables:7,printables:1");
    });

    it("reports zero when the same results come back, in any order", () => {
      const diff = diffSavedSearchResults(
        [item("thingiverse", "2"), item("printables", "1")],
        { lastSeenIds: "printables:1,thingiverse:2", lastRunAt: EARLIER },
      );

      expect(diff.newCount).toBe(0);
    });

    it("treats the same id on another platform as a different result", () => {
      const diff = diffSavedSearchResults(
        [item("printables", "1"), item("thingiverse", "1")],
        { lastSeenIds: "printables:1", lastRunAt: EARLIER },
      );

      expect(diff.newCount).toBe(1);
    });

    it("does not treat a stored key as a prefix match", () => {
      const diff = diffSavedSearchResults([item("printables", "12")], {
        lastSeenIds: "printables:1",
        lastRunAt: EARLIER,
      });

      expect(diff.newCount).toBe(1);
    });

    it("tolerates blank entries in the stored list", () => {
      const diff = diffSavedSearchResults(
        [item("printables", "1"), item("thingiverse", "2"), item("grabcad", "3")],
        { lastSeenIds: ",printables:1,,thingiverse:2,", lastRunAt: EARLIER },
      );

      expect(diff.newCount).toBe(1);
    });

    it("returns an empty list and zero for an empty result set", () => {
      const diff = diffSavedSearchResults([], {
        lastSeenIds: "printables:1",
        lastRunAt: EARLIER,
      });

      expect(diff).toEqual({ newCount: 0, lastSeenIds: "" });
    });

    it("counts every result as new when a run happened but stored nothing", () => {
      // A first run that returned nothing still sets lastRunAt, so the next
      // run reports its whole first page as new. Existing behavior, kept.
      const diff = diffSavedSearchResults(
        [item("printables", "1"), item("thingiverse", "2")],
        { lastSeenIds: "", lastRunAt: EARLIER },
      );

      expect(diff.newCount).toBe(2);
    });
  });

  describe("tracked key cap", () => {
    function storedKeys(lastSeenIds: string): string[] {
      return lastSeenIds === "" ? [] : lastSeenIds.split(",");
    }

    it("is 200", () => {
      expect(MAX_TRACKED_KEYS).toBe(200);
    });

    it("keeps every key up to the cap", () => {
      const { lastSeenIds } = diffSavedSearchResults(printables(MAX_TRACKED_KEYS), {
        lastSeenIds: "",
        lastRunAt: null,
      });

      expect(storedKeys(lastSeenIds)).toHaveLength(MAX_TRACKED_KEYS);
    });

    it("keeps only the first 200 keys beyond the cap", () => {
      const { lastSeenIds } = diffSavedSearchResults(printables(MAX_TRACKED_KEYS + 1), {
        lastSeenIds: "",
        lastRunAt: null,
      });

      const keys = storedKeys(lastSeenIds);
      expect(keys).toHaveLength(MAX_TRACKED_KEYS);
      expect(keys[0]).toBe("printables:0");
      expect(keys[MAX_TRACKED_KEYS - 1]).toBe(`printables:${MAX_TRACKED_KEYS - 1}`);
    });

    it("compares all results, not just the ones it will remember", () => {
      const diff = diffSavedSearchResults(printables(250), {
        lastSeenIds: "",
        lastRunAt: EARLIER,
      });

      expect(diff.newCount).toBe(250);
      expect(storedKeys(diff.lastSeenIds)).toHaveLength(MAX_TRACKED_KEYS);
    });
  });

  describe("purity", () => {
    it("does not modify its inputs", () => {
      const results = Object.freeze([
        Object.freeze(item("printables", "1")),
        Object.freeze(item("thingiverse", "2")),
      ]);
      const previous = Object.freeze({ lastSeenIds: "printables:1", lastRunAt: EARLIER });

      expect(() => diffSavedSearchResults(results, previous)).not.toThrow();
      expect(results).toHaveLength(2);
      expect(previous.lastSeenIds).toBe("printables:1");
    });

    it("gives the same answer when called twice with the same inputs", () => {
      const results = [item("printables", "1"), item("thingiverse", "2")];
      const previous = { lastSeenIds: "printables:1", lastRunAt: EARLIER };

      expect(diffSavedSearchResults(results, previous)).toEqual(
        diffSavedSearchResults(results, previous),
      );
    });
  });
});
