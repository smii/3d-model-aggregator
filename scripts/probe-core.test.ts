import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { makeResult } from "../src/test/factories";
import type { SearchAdapter } from "../src/lib/aggregator/types";
import {
  REQUIRED_ENV,
  exitCodeFor,
  formatTable,
  missingEnv,
  probeAdapter,
  redact,
  sanitize,
  type ProbeRow,
} from "./probe-core";

function adapter(platform: SearchAdapter["platform"], search: SearchAdapter["search"]): SearchAdapter {
  return { platform, search };
}

describe("probeAdapter", () => {
  it("skips, without calling search, when credentials are missing", async () => {
    const search = vi.fn();

    const row = await probeAdapter(adapter("cults3d", search), "benchy", { CULTS3D_USERNAME: "u" });

    expect(search).not.toHaveBeenCalled();
    expect(row.status).toBe("skipped");
    expect(row.detail).toBe("missing credentials: CULTS3D_API_KEY");
  });

  it("reports ok with count, latency and first title", async () => {
    let t = 1000;
    const row = await probeAdapter(
      adapter("grabcad", async () => {
        t += 250;
        return [makeResult({ title: "Benchy\u001b[31m Boat" }), makeResult({ title: "Second" })];
      }),
      "benchy",
      {},
      () => t,
    );

    expect(row).toMatchObject({ status: "ok", count: 2, latencyMs: 250, firstTitle: "Benchy [31m Boat" });
  });

  it("reports ok with zero results", async () => {
    const row = await probeAdapter(adapter("grabcad", async () => []), "x", {});

    expect(row).toMatchObject({ status: "ok", count: 0, firstTitle: "" });
  });

  it("reports failed with the error, redacting credential values", async () => {
    const row = await probeAdapter(
      adapter("myminifactory", async () => {
        throw new Error("bad request ?key=s3cret-value");
      }),
      "x",
      { MYMINIFACTORY_API_KEY: "s3cret-value" },
    );

    expect(row.status).toBe("failed");
    expect(row.detail).toBe("bad request ?key=[redacted]");
  });

  it("stringifies a non-Error rejection", async () => {
    const row = await probeAdapter(adapter("grabcad", () => Promise.reject("nope")), "x", {});

    expect(row).toMatchObject({ status: "failed", detail: "nope" });
  });
});

describe("helpers", () => {
  it("missingEnv lists only unset names and treats empty as unset", () => {
    expect(missingEnv("cults3d", { CULTS3D_USERNAME: "", CULTS3D_API_KEY: "k" })).toEqual(["CULTS3D_USERNAME"]);
    expect(missingEnv("grabcad", {})).toEqual([]);
  });

  it("sanitize strips control characters and truncates", () => {
    expect(sanitize("a\nb\u0007c")).toBe("a b c");
    expect(sanitize("x".repeat(200), 10)).toHaveLength(10);
  });

  it("redact leaves text alone when no credential is set", () => {
    expect(redact("hello", {})).toBe("hello");
  });

  it("exits 1 only when a non-skipped adapter failed", () => {
    const row = (status: ProbeRow["status"]): ProbeRow => ({
      platform: "grabcad",
      status,
      count: null,
      latencyMs: null,
      firstTitle: "",
      detail: "",
    });

    expect(exitCodeFor([row("ok"), row("skipped")])).toBe(0);
    expect(exitCodeFor([row("ok"), row("failed")])).toBe(1);
    expect(exitCodeFor([])).toBe(0);
  });

  it("formatTable prints a header and one line per row", () => {
    const text = formatTable([
      { platform: "grabcad", status: "ok", count: 3, latencyMs: 120, firstTitle: "Gear", detail: "" },
      { platform: "cults3d", status: "skipped", count: null, latencyMs: null, firstTitle: "", detail: "missing credentials: CULTS3D_API_KEY" },
    ]);

    const lines = text.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain("grabcad");
    expect(lines[3]).toContain("skipped");
  });
});

describe("REQUIRED_ENV", () => {
  it.each(Object.entries(REQUIRED_ENV))("%s: every variable is read by the adapter", (platform, names) => {
    const source = readFileSync(new URL(`../src/lib/aggregator/${platform}.ts`, import.meta.url), "utf8");

    for (const name of names ?? []) expect(source).toContain(`process.env.${name}`);
  });

  it("covers every adapter that reads process.env", () => {
    for (const platform of ["thingiverse", "makerworld", "printables", "cults3d", "grabcad", "myminifactory"]) {
      const source = readFileSync(new URL(`../src/lib/aggregator/${platform}.ts`, import.meta.url), "utf8");
      const reads = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);

      expect(reads.sort()).toEqual([...(REQUIRED_ENV[platform as keyof typeof REQUIRED_ENV] ?? [])].sort());
    }
  });
});
