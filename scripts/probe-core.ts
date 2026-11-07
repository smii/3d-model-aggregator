// Pure pieces of the adapter health probe (scripts/probe-adapters.ts), kept
// separate so they can be unit tested without touching the network.
import type { SearchAdapter } from "../src/lib/aggregator/types";
import type { SourcePlatform } from "../src/types/model";

/**
 * Environment variables each adapter needs before it can run. Keep in sync
 * with the adapters (scripts/probe-core.test.ts checks that every name here
 * appears in the adapter source). Only names are ever printed, never values.
 */
export const REQUIRED_ENV: Partial<Record<SourcePlatform, readonly string[]>> = {
  thingiverse: ["THINGIVERSE_APP_TOKEN"],
  cults3d: ["CULTS3D_USERNAME", "CULTS3D_API_KEY"],
  myminifactory: ["MYMINIFACTORY_API_KEY"],
};

export type ProbeStatus = "ok" | "failed" | "skipped";

export interface ProbeRow {
  platform: SourcePlatform;
  status: ProbeStatus;
  count: number | null;
  latencyMs: number | null;
  firstTitle: string;
  detail: string;
}

type Env = Record<string, string | undefined>;

export function missingEnv(platform: SourcePlatform, env: Env): string[] {
  return (REQUIRED_ENV[platform] ?? []).filter((name) => !env[name]);
}

const MAX_TEXT = 80;

/** Remove control characters (third-party text goes to a terminal) and shorten. */
export function sanitize(text: string, max = MAX_TEXT): string {
  const clean = text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Replace any credential value found in `text` with a placeholder. */
export function redact(text: string, env: Env): string {
  let out = text;
  for (const names of Object.values(REQUIRED_ENV)) {
    for (const name of names ?? []) {
      const value = env[name];
      if (value) out = out.split(value).join("[redacted]");
    }
  }
  return out;
}

export async function probeAdapter(
  adapter: SearchAdapter,
  query: string,
  env: Env,
  now: () => number = Date.now,
): Promise<ProbeRow> {
  const missing = missingEnv(adapter.platform, env);
  if (missing.length > 0) {
    return {
      platform: adapter.platform,
      status: "skipped",
      count: null,
      latencyMs: null,
      firstTitle: "",
      detail: `missing credentials: ${missing.join(", ")}`,
    };
  }

  const started = now();
  try {
    const results = await adapter.search({ query, page: 1, perPage: 5 });
    return {
      platform: adapter.platform,
      status: "ok",
      count: results.length,
      latencyMs: now() - started,
      firstTitle: results[0] ? sanitize(results[0].title) : "",
      detail: "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      platform: adapter.platform,
      status: "failed",
      count: null,
      latencyMs: now() - started,
      firstTitle: "",
      detail: sanitize(redact(message, env), 120),
    };
  }
}

/** 1 if any adapter that was not skipped failed, else 0. */
export function exitCodeFor(rows: readonly ProbeRow[]): number {
  return rows.some((row) => row.status === "failed") ? 1 : 0;
}

export function formatTable(rows: readonly ProbeRow[]): string {
  const header = ["platform", "status", "results", "latency", "first title", "error / note"];
  const body = rows.map((row) => [
    row.platform,
    row.status === "skipped" ? "skipped" : row.status,
    row.count === null ? "-" : String(row.count),
    row.latencyMs === null ? "-" : `${row.latencyMs} ms`,
    row.firstTitle || "-",
    row.detail || "-",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...body.map(line)].join("\n");
}
