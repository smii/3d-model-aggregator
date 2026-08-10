// Account-sync scrapers: import a signed-in user's liked/favorited models
// from each platform. Server-only (Playwright); meant to run in background
// workers (see src/lib/sync/import-runner.ts), never in the request path.
import type { SyncPlatform } from "@/lib/sync/platforms";
import { scrapeMakerworldLikes } from "./scrapeMakerworldLikes";
import { scrapePrintablesLikes } from "./scrapePrintablesLikes";
import { scrapeThingiverseLikes } from "./scrapeThingiverseLikes";
import type { AccountSyncAuth, NormalizedLikedModel } from "./types";

export { scrapeMakerworldLikes } from "./scrapeMakerworldLikes";
export { scrapePrintablesLikes } from "./scrapePrintablesLikes";
export { scrapeThingiverseLikes } from "./scrapeThingiverseLikes";
export { unusableAuthReason } from "./types";
export type {
  AccountCredentials,
  AccountSyncAuth,
  NormalizedLikedModel,
  SessionCookie,
} from "./types";

const SCRAPERS: Record<
  SyncPlatform,
  (auth: AccountSyncAuth) => Promise<NormalizedLikedModel[]>
> = {
  makerworld: scrapeMakerworldLikes,
  printables: scrapePrintablesLikes,
  thingiverse: scrapeThingiverseLikes,
};

/** Dispatch to the platform-specific scraper. */
export function scrapeAccountLikes(
  platform: SyncPlatform,
  auth: AccountSyncAuth
): Promise<NormalizedLikedModel[]> {
  return SCRAPERS[platform](auth);
}
