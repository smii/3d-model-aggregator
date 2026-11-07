export const CONTESTS_REVALIDATE_SECONDS = 60 * 60;

const TIMEOUT_MS = 10_000;

// Identifies this app instead of imitating a browser: contest sources must
// never spoof headers or evade bot protection (three-drop-integration.md, section 3).
const USER_AGENT = '3d-model-aggregator/0.1 (contest listing fetch)';

/**
 * Fetch JSON for a contest source, cached in the Next.js Data Cache and
 * revalidated hourly so a page view never hits the platform directly.
 *
 * Not the aggregator's `fetchJson`: that forces `cache: 'no-store'`, which
 * would call the platform on every request. A non-2xx response (including a
 * 403 bot challenge) throws; callers report it, they do not retry around it.
 */
export async function fetchContestJson<T>(
  url: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('User-Agent')) headers.set('User-Agent', USER_AGENT);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const response = await fetch(url, {
    ...init,
    headers,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    next: { revalidate: CONTESTS_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} from ${new URL(url).host}`);
  }

  return (await response.json()) as T;
}
