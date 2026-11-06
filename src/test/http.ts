import { vi } from "vitest";

export interface FetchCall {
  url: string;
  init: RequestInit;
}

type Responder = (call: FetchCall) => Response | Promise<Response>;

/** A JSON response, as the adapters' fetchJson wrapper expects. */
export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

/** An error response; fetchJson reports it as "<status> <statusText> from <host>". */
export function errorResponse(status: number, statusText: string): Response {
  return new Response("", { status, statusText });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Replace global fetch with a stub that answers every request through
 * `respond` and records what was asked. vitest.setup.ts puts the guard stub
 * back after each test, so nothing here leaks between tests.
 */
export function stubFetch(respond: Responder): {
  calls: FetchCall[];
  stub: ReturnType<typeof vi.fn>;
} {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: requestUrl(input), init };
    calls.push(call);
    return respond(call);
  });
  vi.stubGlobal("fetch", stub);
  return { calls, stub };
}

/** Shorthand: every request gets the same JSON body. */
export function stubFetchJson(body: unknown): ReturnType<typeof stubFetch> {
  return stubFetch(() => jsonResponse(body));
}
