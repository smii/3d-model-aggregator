const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch JSON with a per-request timeout so one slow platform cannot stall the
 * whole aggregated search past the route handler's budget.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, {
    ...init,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${new URL(url).host}`);
  }

  return (await response.json()) as T;
}
