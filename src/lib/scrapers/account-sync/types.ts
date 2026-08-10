import type { SyncPlatform } from "@/lib/sync/platforms";

/** Playwright-compatible cookie, as stored (AES-256-encrypted) per PlatformAccount. */
export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

/** Username/email + password login, used only when no cookies are available. */
export interface AccountCredentials {
  identifier: string;
  password: string;
}

/**
 * Authentication material for an account-sync scrape. Cookies are always
 * preferred: credential logins run through the platform's real login form and
 * can be blocked by CAPTCHA or 2FA, in which case the scraper throws with a
 * message asking for session cookies instead.
 */
export interface AccountSyncAuth {
  cookies?: SessionCookie[];
  credentials?: AccountCredentials;
  /** Public profile username; enables the Thingiverse REST API path. */
  username?: string;
}

/** Normalized liked/favorited model, superset of the import runner's ScrapedModel. */
export interface NormalizedLikedModel {
  externalId: string;
  title: string;
  externalUrl: string;
  thumbnailUrl: string | null;
  author: string | null;
  likesCount: number;
  collectionName: string | null;
  sourcePlatform: SyncPlatform;
}

export function requireAuth(auth: AccountSyncAuth, platform: SyncPlatform): void {
  if (!auth.cookies?.length && !auth.credentials && !auth.username) {
    throw new Error(
      `${platform}: no session cookies, credentials, or username provided`
    );
  }
}

/**
 * Shape-only check that the given auth can possibly work for the platform,
 * mirroring what each scraper accepts (see scrape*Likes.ts). Lets the API
 * reject dead-on-arrival requests up front instead of failing the background
 * job. Returns an error message, or null when the auth is usable.
 */
export function unusableAuthReason(
  auth: AccountSyncAuth,
  platform: SyncPlatform
): string | null {
  if (auth.cookies?.length) return null;
  switch (platform) {
    case "makerworld":
      return auth.credentials
        ? null
        : "MakerWorld requires session cookies or account credentials";
    case "thingiverse":
      return auth.username
        ? null
        : "Thingiverse requires session cookies, or a profile username (public likes via the Thingiverse API)";
    case "printables":
      return "Printables requires session cookies — credential login is not supported";
  }
}
