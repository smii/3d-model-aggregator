// Characterization test for POST /api/saved-searches/run.
//
// It pins what the route writes to the database and what it returns, with the
// database and the aggregator mocked. It was written and run against the
// original inline diff logic, then left byte-for-byte unchanged while that
// logic moved into src/lib/saved-searches/diff.ts: if the extraction altered
// behaviour, this file would fail.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchAdapter } from "@/lib/aggregator";
import { makeResult } from "@/test/factories";
import type { SourcePlatform } from "@/types/model";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  resolveSearchAdapters: vi.fn(),
  searchAllPlatforms: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { savedSearch: { findMany: mocks.findMany, update: mocks.update } },
}));

vi.mock("@/lib/aggregator", () => ({
  resolveSearchAdapters: mocks.resolveSearchAdapters,
  searchAllPlatforms: mocks.searchAllPlatforms,
}));

import { POST } from "./route";

const NOW = new Date("2026-03-01T12:00:00.000Z");

interface SavedSearchRow {
  id: string;
  name: string;
  query: string;
  platforms: string;
  category: string | null;
  sort: string;
  lastSeenIds: string;
  newResultsCount: number;
  lastRunAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeSearch(overrides: Partial<SavedSearchRow> = {}): SavedSearchRow {
  return {
    id: "search-1",
    name: "Benchy",
    query: "benchy",
    platforms: "",
    category: null,
    sort: "newest",
    lastSeenIds: "",
    newResultsCount: 0,
    lastRunAt: null,
    lastError: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function found(platform: SourcePlatform, id: string) {
  return makeResult({ sourcePlatform: platform, id });
}

/** `count` distinct printables results with ids "0".."count-1". */
function manyResults(count: number) {
  return Array.from({ length: count }, (_, i) => found("printables", String(i)));
}

const fakeAdapter = { platform: "printables" } as unknown as SearchAdapter;

function givenSearches(...searches: SavedSearchRow[]) {
  mocks.findMany.mockResolvedValue(searches);
}

function givenSearchReturns(
  results: ReturnType<typeof found>[],
  failures: { platform: SourcePlatform; error: string }[] = [],
) {
  mocks.searchAllPlatforms.mockResolvedValue({ results, failures });
}

function post(query = "") {
  return POST(
    new Request(`http://localhost/api/saved-searches/run${query}`, { method: "POST" }),
  );
}

/** The `data` payload of the n-th prisma.savedSearch.update call. */
function updateData(call = 0) {
  return mocks.update.mock.calls[call][0].data;
}

function storedKeys(call = 0): string[] {
  const { lastSeenIds } = updateData(call);
  return lastSeenIds === "" ? [] : lastSeenIds.split(",");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);

  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.update.mockResolvedValue({});
  mocks.resolveSearchAdapters.mockReturnValue({ adapters: [fakeAdapter], skipped: [] });
  givenSearchReturns([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("first run (no lastRunAt)", () => {
  it("establishes the baseline: stores the keys and counts nothing as new", async () => {
    givenSearches(makeSearch({ lastRunAt: null, lastSeenIds: "" }));
    givenSearchReturns([found("printables", "1"), found("thingiverse", "2")]);

    const response = await post();

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: {
        lastRunAt: NOW,
        lastSeenIds: "printables:1,thingiverse:2",
        newResultsCount: { increment: 0 },
        lastError: null,
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ran: 1 });
  });

  it("counts nothing as new even when stale ids are already stored", async () => {
    givenSearches(makeSearch({ lastRunAt: null, lastSeenIds: "printables:9" }));
    givenSearchReturns([found("printables", "1")]);

    await post();

    expect(updateData().newResultsCount).toEqual({ increment: 0 });
    expect(updateData().lastSeenIds).toBe("printables:1");
  });
});

describe("later runs (lastRunAt set)", () => {
  const lastRunAt = new Date("2026-02-01T00:00:00.000Z");

  it("increments newResultsCount by the results whose key was not seen last time", async () => {
    givenSearches(
      makeSearch({ lastRunAt, lastSeenIds: "printables:1,thingiverse:2", newResultsCount: 5 }),
    );
    givenSearchReturns([
      found("printables", "1"),
      found("thingiverse", "2"),
      found("makerworld", "3"),
      found("cults3d", "4"),
    ]);

    await post();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: {
        lastRunAt: NOW,
        lastSeenIds: "printables:1,thingiverse:2,makerworld:3,cults3d:4",
        // An increment, not a replacement: the 5 already stored is untouched.
        newResultsCount: { increment: 2 },
        lastError: null,
      },
    });
  });

  it("stores the current keys in result order, replacing the old list", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "printables:1,printables:2" }));
    givenSearchReturns([found("printables", "2"), found("printables", "7"), found("printables", "1")]);

    await post();

    expect(updateData().lastSeenIds).toBe("printables:2,printables:7,printables:1");
    expect(updateData().newResultsCount).toEqual({ increment: 1 });
  });

  it("increments by zero when nothing changed", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "printables:1,thingiverse:2" }));
    givenSearchReturns([found("thingiverse", "2"), found("printables", "1")]);

    await post();

    expect(updateData().newResultsCount).toEqual({ increment: 0 });
  });

  it("keys results by platform AND id: the same id on another platform is new", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "printables:1" }));
    givenSearchReturns([found("printables", "1"), found("thingiverse", "1")]);

    await post();

    expect(updateData().newResultsCount).toEqual({ increment: 1 });
    expect(updateData().lastSeenIds).toBe("printables:1,thingiverse:1");
  });

  it("ignores blank entries in the stored list", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: ",printables:1,,thingiverse:2," }));
    givenSearchReturns([found("printables", "1"), found("thingiverse", "2"), found("grabcad", "3")]);

    await post();

    expect(updateData().newResultsCount).toEqual({ increment: 1 });
  });

  it("stores an empty list and counts nothing when the run returns no results", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "printables:1" }));
    givenSearchReturns([]);

    await post();

    expect(updateData().lastSeenIds).toBe("");
    expect(updateData().newResultsCount).toEqual({ increment: 0 });
  });

  it("counts every result as new when a run happened but stored no ids", async () => {
    // Quirk worth knowing about: a first run that returned nothing (for
    // example because every platform failed) still sets lastRunAt, so the
    // next run reports its whole first page as new.
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "" }));
    givenSearchReturns([found("printables", "1"), found("thingiverse", "2"), found("grabcad", "3")]);

    await post();

    expect(updateData().newResultsCount).toEqual({ increment: 3 });
  });
});

describe("tracked key cap", () => {
  const lastRunAt = new Date("2026-02-01T00:00:00.000Z");

  it("stores all keys at exactly 200 results", async () => {
    givenSearches(makeSearch({ lastRunAt: null }));
    givenSearchReturns(manyResults(200));

    await post();

    expect(storedKeys()).toHaveLength(200);
    expect(storedKeys()[199]).toBe("printables:199");
  });

  it("stores only the first 200 keys when there are more", async () => {
    givenSearches(makeSearch({ lastRunAt: null }));
    givenSearchReturns(manyResults(201));

    await post();

    const keys = storedKeys();
    expect(keys).toHaveLength(200);
    expect(keys[0]).toBe("printables:0");
    expect(keys[199]).toBe("printables:199");
    expect(keys).not.toContain("printables:200");
  });

  it("still counts new results beyond the cap", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "" }));
    givenSearchReturns(manyResults(250));

    await post();

    expect(storedKeys()).toHaveLength(200);
    expect(updateData().newResultsCount).toEqual({ increment: 250 });
  });
});

describe("platform failures", () => {
  const lastRunAt = new Date("2026-02-01T00:00:00.000Z");

  it("records which platforms failed and still diffs the ones that answered", async () => {
    givenSearches(makeSearch({ lastRunAt, lastSeenIds: "printables:1" }));
    givenSearchReturns(
      [found("printables", "1"), found("printables", "2")],
      [
        { platform: "thingiverse", error: "401 Unauthorized from api.thingiverse.com" },
        { platform: "grabcad", error: "boom" },
      ],
    );

    await post();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: {
        lastRunAt: NOW,
        lastSeenIds: "printables:1,printables:2",
        newResultsCount: { increment: 1 },
        lastError: "2 platform(s) failed: thingiverse, grabcad",
      },
    });
  });

  it("clears an earlier error after a clean run", async () => {
    givenSearches(makeSearch({ lastRunAt, lastError: "1 platform(s) failed: grabcad" }));
    givenSearchReturns([found("printables", "1")]);

    await post();

    expect(updateData().lastError).toBeNull();
  });
});

describe("runs that cannot produce a result list", () => {
  it("reports 'No platforms support this search.' without searching", async () => {
    givenSearches(makeSearch({ lastRunAt: new Date("2026-02-01T00:00:00.000Z"), lastSeenIds: "printables:1" }));
    mocks.resolveSearchAdapters.mockReturnValue({ adapters: [], skipped: ["printables"] });

    const response = await post();

    expect(mocks.searchAllPlatforms).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    // Only these two columns: the stored ids and counter are left alone.
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: { lastRunAt: NOW, lastError: "No platforms support this search." },
    });
    expect(await response.json()).toEqual({ ran: 1 });
  });

  it("stores the error message when the search throws an Error", async () => {
    givenSearches(makeSearch({ lastRunAt: new Date("2026-02-01T00:00:00.000Z"), lastSeenIds: "printables:1" }));
    mocks.searchAllPlatforms.mockRejectedValue(new Error("kaput"));

    const response = await post();

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "search-1" },
      data: { lastRunAt: NOW, lastError: "kaput" },
    });
    expect(await response.json()).toEqual({ ran: 1 });
  });

  it("stringifies a non-Error rejection", async () => {
    givenSearches(makeSearch());
    mocks.searchAllPlatforms.mockRejectedValue("plain string");

    await post();

    expect(updateData().lastError).toBe("plain string");
  });

  it("keeps going with the next saved search after one throws", async () => {
    givenSearches(makeSearch({ id: "a" }), makeSearch({ id: "b" }));
    mocks.searchAllPlatforms
      .mockRejectedValueOnce(new Error("first fails"))
      .mockResolvedValueOnce({ results: [found("printables", "1")], failures: [] });

    const response = await post();

    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.update.mock.calls[0][0]).toEqual({
      where: { id: "a" },
      data: { lastRunAt: NOW, lastError: "first fails" },
    });
    expect(mocks.update.mock.calls[1][0].where).toEqual({ id: "b" });
    expect(mocks.update.mock.calls[1][0].data.lastSeenIds).toBe("printables:1");
    expect(await response.json()).toEqual({ ran: 2 });
  });
});

describe("how the search is dispatched", () => {
  it("passes the saved platforms, query and a valid category through", async () => {
    givenSearches(
      makeSearch({ query: "benchy", platforms: "printables,thingiverse", category: "toys_games" }),
    );

    await post();

    expect(mocks.resolveSearchAdapters).toHaveBeenCalledWith({
      platforms: "printables,thingiverse",
      category: "toys_games",
    });
    expect(mocks.searchAllPlatforms).toHaveBeenCalledWith(
      { query: "benchy", page: 1, category: "toys_games" },
      [fakeAdapter],
    );
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["an unknown value", "not_a_category"],
  ])("drops a category that is %s", async (_label, category) => {
    givenSearches(makeSearch({ category }));

    await post();

    expect(mocks.resolveSearchAdapters).toHaveBeenCalledWith({
      platforms: "",
      category: undefined,
    });
    expect(mocks.searchAllPlatforms).toHaveBeenCalledWith(
      { query: "benchy", page: 1, category: undefined },
      [fakeAdapter],
    );
  });
});

describe("request handling", () => {
  it("runs every saved search when no id is given", async () => {
    givenSearches(makeSearch({ id: "a" }), makeSearch({ id: "b" }), makeSearch({ id: "c" }));

    const response = await post();

    expect(mocks.findMany).toHaveBeenCalledWith(undefined);
    expect(mocks.update.mock.calls.map(([arg]) => arg.where.id)).toEqual(["a", "b", "c"]);
    expect(await response.json()).toEqual({ ran: 3 });
  });

  it("runs only the requested search when ?id= is given", async () => {
    givenSearches(makeSearch({ id: "wanted" }));

    const response = await post("?id=wanted");

    expect(mocks.findMany).toHaveBeenCalledWith({ where: { id: "wanted" } });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(await response.json()).toEqual({ ran: 1 });
  });

  it("answers 404 and writes nothing when ?id= matches no saved search", async () => {
    givenSearches();

    const response = await post("?id=missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Saved search not found." });
    expect(mocks.searchAllPlatforms).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("reports ran: 0 when there are no saved searches and no id", async () => {
    givenSearches();

    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ran: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("runs saved searches one after another, never in parallel", async () => {
    givenSearches(makeSearch({ id: "a" }), makeSearch({ id: "b" }));
    const events: string[] = [];
    let releaseFirst: () => void = () => {};
    mocks.searchAllPlatforms
      .mockImplementationOnce(async () => {
        events.push("start a");
        await new Promise<void>((resolve) => {
          releaseFirst = resolve;
        });
        events.push("end a");
        return { results: [], failures: [] };
      })
      .mockImplementationOnce(async () => {
        events.push("start b");
        return { results: [], failures: [] };
      });

    const pending = post();
    await vi.waitFor(() => expect(events).toEqual(["start a"]));
    // Let the event loop turn a few times: b must still be waiting for a.
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
    expect(events).toEqual(["start a"]);

    releaseFirst();
    await pending;

    expect(events).toEqual(["start a", "end a", "start b"]);
  });
});
