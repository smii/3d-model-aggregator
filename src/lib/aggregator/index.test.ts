// resolveSearchAdapters and searchAllPlatforms, with all six real adapters
// replaced by fakes so these tests cover the aggregator's own rules (platform
// resolution, native-only category filtering, partial failure, merge order)
// and keep passing when an adapter's real category support changes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { makeResult } from "@/test/factories";
import type { ModelCategory, SourcePlatform, UnifiedModelResult } from "@/types/model";
import type { SearchAdapter, SearchOptions } from "./types";

interface FakeAdapter {
  platform: SourcePlatform;
  search: Mock<(options: SearchOptions) => Promise<UnifiedModelResult[]>>;
  supportsCategory?: Mock<(category: ModelCategory) => boolean>;
}

const fakes = vi.hoisted(() => {
  const fake = (platform: string) => ({
    platform,
    search: vi.fn(),
    supportsCategory: vi.fn(),
  });
  return {
    thingiverse: fake("thingiverse"),
    makerworld: fake("makerworld"),
    printables: fake("printables"),
    cults3d: fake("cults3d"),
    grabcad: fake("grabcad"),
    myminifactory: fake("myminifactory"),
  };
});

vi.mock("./thingiverse", () => ({ thingiverseAdapter: fakes.thingiverse }));
vi.mock("./makerworld", () => ({ makerworldAdapter: fakes.makerworld }));
vi.mock("./printables", () => ({ printablesAdapter: fakes.printables }));
vi.mock("./cults3d", () => ({ cults3dAdapter: fakes.cults3d }));
vi.mock("./grabcad", () => ({ grabcadAdapter: fakes.grabcad }));
vi.mock("./myminifactory", () => ({ myminifactoryAdapter: fakes.myminifactory }));

import { resolveSearchAdapters, searchAllPlatforms } from "./index";

const ALL_PLATFORMS: SourcePlatform[] = [
  "thingiverse",
  "makerworld",
  "printables",
  "cults3d",
  "grabcad",
  "myminifactory",
];

const fakeList = Object.values(fakes) as unknown as FakeAdapter[];

function hit(platform: SourcePlatform, id: string, title = `Model ${platform} ${id}`) {
  return makeResult({ sourcePlatform: platform, id, title });
}

function platformsOf(adapters: SearchAdapter[]): SourcePlatform[] {
  return adapters.map((adapter) => adapter.platform);
}

/** A standalone adapter for tests that pass adapters to searchAllPlatforms directly. */
function adapterReturning(platform: SourcePlatform, results: UnifiedModelResult[]): SearchAdapter {
  return { platform, search: vi.fn().mockResolvedValue(results) };
}

function adapterFailing(platform: SourcePlatform, reason: unknown): SearchAdapter {
  return { platform, search: vi.fn().mockRejectedValue(reason) };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const fake of fakeList) {
    fake.search.mockReset();
    fake.search.mockResolvedValue([]);
    fake.supportsCategory = vi.fn().mockReturnValue(false);
  }
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("resolveSearchAdapters", () => {
  describe("choosing platforms", () => {
    it("returns every adapter, in registry order, when no platforms are given", () => {
      const { adapters, skipped } = resolveSearchAdapters({});

      expect(platformsOf(adapters)).toEqual(ALL_PLATFORMS);
      expect(skipped).toEqual([]);
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
    ])("treats platforms: %s as every platform", (_label, platforms) => {
      expect(platformsOf(resolveSearchAdapters({ platforms }).adapters)).toEqual(ALL_PLATFORMS);
    });

    it("returns the requested adapters in the order requested", () => {
      const { adapters } = resolveSearchAdapters({ platforms: "grabcad,thingiverse" });

      expect(platformsOf(adapters)).toEqual(["grabcad", "thingiverse"]);
    });

    it("silently drops names that have no adapter", () => {
      // thangs and crealitycloud are known platforms with no adapter (their
      // search sits behind Cloudflare bot protection); "bogus" is not a platform.
      const { adapters } = resolveSearchAdapters({
        platforms: "thangs,printables,crealitycloud,bogus",
      });

      expect(platformsOf(adapters)).toEqual(["printables"]);
    });

    it("ignores empty entries in the list", () => {
      const { adapters } = resolveSearchAdapters({ platforms: ",printables,,grabcad," });

      expect(platformsOf(adapters)).toEqual(["printables", "grabcad"]);
    });

    it("returns the same adapter objects the aggregator searches with", () => {
      const { adapters } = resolveSearchAdapters({ platforms: "printables" });

      expect(adapters[0]).toBe(fakes.printables);
    });

    it("returns no adapters for an empty platforms string", () => {
      // Current behavior, recorded rather than endorsed: prisma/schema.prisma
      // documents SavedSearch.platforms as "empty = all", but "" splits to an
      // empty list, which is truthy, so nothing is selected. null/undefined
      // (the /api/search default) do mean "all".
      expect(resolveSearchAdapters({ platforms: "" }).adapters).toEqual([]);
    });

    it("returns an adapter once per mention when a platform is repeated", () => {
      // Current behavior: no de-duplication, so a repeated name fans out to
      // the same upstream platform repeatedly.
      const { adapters } = resolveSearchAdapters({ platforms: "printables,printables,printables" });

      expect(platformsOf(adapters)).toEqual(["printables", "printables", "printables"]);
    });
  });

  describe("category filtering (native support only)", () => {
    it("keeps only adapters that natively support the category", () => {
      fakes.printables.supportsCategory.mockImplementation((c: string) => c === "toys_games");
      fakes.cults3d.supportsCategory.mockImplementation((c: string) => c === "toys_games");

      const { adapters, skipped } = resolveSearchAdapters({ category: "toys_games" });

      expect(platformsOf(adapters)).toEqual(["printables", "cults3d"]);
      expect(skipped).toEqual(["thingiverse", "makerworld", "grabcad", "myminifactory"]);
    });

    it("asks each adapter about the requested category", () => {
      resolveSearchAdapters({ category: "miniatures" });

      for (const fake of fakeList) {
        expect(fake.supportsCategory).toHaveBeenCalledWith("miniatures");
      }
    });

    it("skips every adapter when none supports the category", () => {
      const { adapters, skipped } = resolveSearchAdapters({ category: "fashion" });

      expect(adapters).toEqual([]);
      expect(skipped).toEqual(ALL_PLATFORMS);
    });

    it("reports as skipped only the platforms that were asked for", () => {
      fakes.printables.supportsCategory.mockReturnValue(true);

      const { adapters, skipped } = resolveSearchAdapters({
        platforms: "printables,thingiverse",
        category: "tools",
      });

      expect(platformsOf(adapters)).toEqual(["printables"]);
      expect(skipped).toEqual(["thingiverse"]);
    });

    it("treats an adapter with no supportsCategory method as unsupported", () => {
      delete (fakes.grabcad as Partial<typeof fakes.grabcad>).supportsCategory;

      const { adapters, skipped } = resolveSearchAdapters({
        platforms: "grabcad",
        category: "tools",
      });

      expect(adapters).toEqual([]);
      expect(skipped).toEqual(["grabcad"]);
    });

    it("does not consult supportsCategory, or skip anything, without a category", () => {
      const { adapters, skipped } = resolveSearchAdapters({});

      expect(adapters).toHaveLength(ALL_PLATFORMS.length);
      expect(skipped).toEqual([]);
      for (const fake of fakeList) expect(fake.supportsCategory).not.toHaveBeenCalled();
    });
  });
});

describe("searchAllPlatforms", () => {
  describe("fan-out", () => {
    it("searches every default adapter when none are passed", async () => {
      await searchAllPlatforms({ query: "benchy" });

      for (const fake of fakeList) expect(fake.search).toHaveBeenCalledTimes(1);
    });

    it("searches only the adapters it is given", async () => {
      const printables = adapterReturning("printables", []);

      await searchAllPlatforms({ query: "benchy" }, [printables]);

      expect(printables.search).toHaveBeenCalledTimes(1);
      for (const fake of fakeList) expect(fake.search).not.toHaveBeenCalled();
    });

    it("passes the same options to every adapter", async () => {
      const controller = new AbortController();
      const options: SearchOptions = {
        query: "benchy",
        page: 2,
        perPage: 10,
        category: "toys_games",
        signal: controller.signal,
      };
      const a = adapterReturning("printables", []);
      const b = adapterReturning("thingiverse", []);

      await searchAllPlatforms(options, [a, b]);

      expect(a.search).toHaveBeenCalledWith(options);
      expect(b.search).toHaveBeenCalledWith(options);
    });

    it("starts every adapter before waiting for any of them (Promise.allSettled)", async () => {
      const releases: Array<(results: UnifiedModelResult[]) => void> = [];
      const adapters: SearchAdapter[] = (["printables", "thingiverse", "grabcad"] as const).map(
        (platform) => ({
          platform,
          search: vi.fn(
            () =>
              new Promise<UnifiedModelResult[]>((resolve) => {
                releases.push(resolve);
              }),
          ),
        }),
      );

      const pending = searchAllPlatforms({ query: "benchy" }, adapters);

      // Nothing has resolved, yet all three requests are already in flight.
      expect(releases).toHaveLength(3);

      releases[2]([hit("grabcad", "g1")]);
      releases[0]([hit("printables", "p1")]);
      releases[1]([hit("thingiverse", "t1")]);
      const { results } = await pending;

      // Order follows the adapters, not who finished first.
      expect(results.map((r) => r.id)).toEqual(["p1", "t1", "g1"]);
    });

    it("returns no results and no failures when given no adapters", async () => {
      expect(await searchAllPlatforms({ query: "benchy" }, [])).toEqual({
        results: [],
        failures: [],
      });
    });
  });

  describe("partial failure", () => {
    it("reports a rejected adapter in failures and keeps the others' results", async () => {
      const adapters = [
        adapterReturning("printables", [hit("printables", "p1")]),
        adapterFailing("thingiverse", new Error("401 Unauthorized from api.thingiverse.com")),
        adapterReturning("grabcad", [hit("grabcad", "g1")]),
      ];

      const { results, failures } = await searchAllPlatforms({ query: "benchy" }, adapters);

      expect(results.map((r) => r.id)).toEqual(["p1", "g1"]);
      expect(failures).toEqual([
        { platform: "thingiverse", error: "401 Unauthorized from api.thingiverse.com" },
      ]);
    });

    it("stringifies a rejection that is not an Error", async () => {
      const { failures } = await searchAllPlatforms({ query: "benchy" }, [
        adapterFailing("printables", "plain string"),
        adapterFailing("grabcad", 42),
      ]);

      expect(failures).toEqual([
        { platform: "printables", error: "plain string" },
        { platform: "grabcad", error: "42" },
      ]);
    });

    it("lists failures in adapter order", async () => {
      const { failures } = await searchAllPlatforms({ query: "benchy" }, [
        adapterFailing("grabcad", new Error("a")),
        adapterReturning("printables", []),
        adapterFailing("thingiverse", new Error("b")),
      ]);

      expect(failures.map((f) => f.platform)).toEqual(["grabcad", "thingiverse"]);
    });

    it("returns empty results with every platform in failures when all adapters fail", async () => {
      const { results, failures } = await searchAllPlatforms({ query: "benchy" }, [
        adapterFailing("printables", new Error("down")),
        adapterFailing("thingiverse", new Error("down")),
      ]);

      expect(results).toEqual([]);
      expect(failures).toHaveLength(2);
    });

    it("does not treat an adapter that returns no results as a failure", async () => {
      const { results, failures } = await searchAllPlatforms({ query: "benchy" }, [
        adapterReturning("printables", []),
      ]);

      expect(results).toEqual([]);
      expect(failures).toEqual([]);
    });

    it("logs each failure with its platform", async () => {
      await searchAllPlatforms({ query: "benchy" }, [
        adapterFailing("thingiverse", new Error("boom")),
      ]);

      expect(errorSpy).toHaveBeenCalledWith("[aggregator] thingiverse search failed: boom");
    });

    it("keeps working when a real default adapter rejects", async () => {
      fakes.cults3d.search.mockRejectedValue(new Error("cults down"));
      fakes.printables.search.mockResolvedValue([hit("printables", "p1")]);

      const { results, failures } = await searchAllPlatforms({ query: "benchy" });

      expect(results.map((r) => r.id)).toEqual(["p1"]);
      expect(failures).toEqual([{ platform: "cults3d", error: "cults down" }]);
    });
  });

  describe("merging", () => {
    it("interleaves platforms round-robin instead of concatenating them", async () => {
      const { results } = await searchAllPlatforms({ query: "benchy" }, [
        adapterReturning("printables", [hit("printables", "p1"), hit("printables", "p2"), hit("printables", "p3")]),
        adapterReturning("thingiverse", [hit("thingiverse", "t1")]),
        adapterReturning("grabcad", [hit("grabcad", "g1"), hit("grabcad", "g2")]),
      ]);

      expect(results.map((r) => r.id)).toEqual(["p1", "t1", "g1", "p2", "g2", "p3"]);
    });

    it("drops a repeated platform:id, keeping the first occurrence", async () => {
      const first = hit("printables", "p1", "First copy");
      const again = hit("printables", "p1", "Second copy");

      const { results } = await searchAllPlatforms({ query: "benchy" }, [
        adapterReturning("printables", [first]),
        adapterReturning("printables", [again, hit("printables", "p2")]),
      ]);

      expect(results.map((r) => r.id)).toEqual(["p1", "p2"]);
      expect(results[0].title).toBe("First copy");
    });

    it("keeps the same id when it comes from different platforms", async () => {
      const { results } = await searchAllPlatforms({ query: "benchy" }, [
        adapterReturning("printables", [hit("printables", "7", "Alpha one")]),
        adapterReturning("thingiverse", [hit("thingiverse", "7", "Bravo two")]),
      ]);

      expect(results.map((r) => `${r.sourcePlatform}:${r.id}`)).toEqual(["printables:7", "thingiverse:7"]);
    });

    it("flags the same model on two platforms via alsoFoundOn, ignoring the query words", async () => {
      const { results } = await searchAllPlatforms({ query: "dragon" }, [
        adapterReturning("printables", [hit("printables", "p1", "Crystal Dragon Egg Holder")]),
        adapterReturning("thingiverse", [hit("thingiverse", "t1", "Dragon Egg Holder Crystal")]),
        adapterReturning("grabcad", [hit("grabcad", "g1", "Dragon Skull")]),
      ]);

      expect(results[0].alsoFoundOn).toEqual([{ platform: "thingiverse", id: "t1" }]);
      expect(results[1].alsoFoundOn).toEqual([{ platform: "printables", id: "p1" }]);
      expect(results[2].alsoFoundOn).toBeUndefined();
    });
  });
});
