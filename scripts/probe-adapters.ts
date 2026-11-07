// Adapter health probe. CLI only, on purpose: an HTTP route that fans out to
// every platform without authentication would be an abuse vector.
//
//   npm run probe              # query "benchy"
//   npm run probe -- dragon    # custom query
//
// Runs each adapter once, concurrently. Adapters whose credentials are not set
// are skipped without touching the network. Exit code 1 if any adapter that
// ran failed. Prints credential variable names, never their values.
import { resolveSearchAdapters } from "../src/lib/aggregator";
import { exitCodeFor, formatTable, probeAdapter } from "./probe-core";

async function main(): Promise<number> {
  const query = process.argv.slice(2).join(" ").trim() || "benchy";
  const { adapters } = resolveSearchAdapters({});

  console.log(`Probing ${adapters.length} adapters with query "${query}"\n`);
  const settled = await Promise.allSettled(
    adapters.map((adapter) => probeAdapter(adapter, query, process.env)),
  );

  const rows = settled.map((outcome, index) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : {
          platform: adapters[index].platform,
          status: "failed" as const,
          count: null,
          latencyMs: null,
          firstTitle: "",
          detail: "probe crashed",
        },
  );

  console.log(formatTable(rows));
  const code = exitCodeFor(rows);
  console.log(`\nexit ${code}`);
  return code;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  },
);
