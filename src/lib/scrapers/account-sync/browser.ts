// Shared Playwright plumbing for the account-sync scrapers. Server-only:
// never import this from client components (see src/lib/sync/platforms.ts
// for the client-safe constants).
import { chromium, type BrowserContext, type Page } from "playwright";
import type { SyncPlatform } from "@/lib/sync/platforms";
import type { NormalizedLikedModel, SessionCookie } from "./types";

export async function withBrowserContext<T>(
  cookies: SessionCookie[] | undefined,
  fn: (context: BrowserContext) => Promise<T>
): Promise<T> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    if (cookies?.length) {
      await context.addCookies(cookies);
    }
    return await fn(context);
  } finally {
    await browser.close();
  }
}

/** Scroll to the bottom repeatedly so infinite-scroll lists fully render. */
export async function autoScroll(page: Page, maxRounds = 15): Promise<void> {
  let previousHeight = 0;
  for (let round = 0; round < maxRounds; round++) {
    const height = await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      return document.body.scrollHeight;
    });
    if (height === previousHeight) break;
    previousHeight = height;
    await page.waitForTimeout(1_000);
  }
}

export async function gotoAndSettle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  // Ad/analytics beacons can keep the network busy forever; autoScroll below
  // still gives content time to render, so a networkidle timeout is fine.
  await page
    .waitForLoadState("networkidle", { timeout: 30_000 })
    .catch(() => undefined);
  await autoScroll(page);
}

export function assertLoggedIn(page: Page, platform: SyncPlatform): void {
  if (/\/(login|signin|sign-in|account\/auth)/i.test(page.url())) {
    throw new Error(
      `${platform} redirected to a login page — the provided session is invalid or expired`
    );
  }
}

/**
 * DOM-based extraction keyed on model detail links, the most stable part of
 * each site's markup: collect every anchor matching `linkPattern`, dedupe by
 * the captured id, and pull title/thumbnail from the enclosing card.
 */
export function extractModelsByLink(
  page: Page,
  options: {
    linkPattern: RegExp;
    platform: SyncPlatform;
    collectionName: string;
  }
): Promise<NormalizedLikedModel[]> {
  return page.$$eval(
    "a[href]",
    (anchors, args) => {
      const linkPattern = new RegExp(args.linkPatternSource);
      const byId = new Map<string, NormalizedLikedModel>();

      for (const anchor of anchors as HTMLAnchorElement[]) {
        const match = anchor.href.match(linkPattern);
        if (!match) continue;
        const externalId = match[1];

        // Walk up a few levels to the enclosing card; the anchor itself is
        // often just the image or title fragment.
        let card: HTMLElement = anchor;
        for (let i = 0; i < 4 && card.parentElement; i++) {
          card = card.parentElement;
        }

        const title =
          anchor.textContent?.trim() ||
          card
            .querySelector("h1, h2, h3, h4, [class*='title' i]")
            ?.textContent?.trim() ||
          card.querySelector("img")?.alt?.trim() ||
          "";
        const thumbnailUrl = card.querySelector("img")?.src ?? null;
        const author =
          card
            .querySelector("[class*='author' i], [class*='user' i] a, [href*='/@']")
            ?.textContent?.trim() || null;

        const existing = byId.get(externalId);
        // Keep the richest variant when the same model appears in several
        // anchors (image link, title link, etc.).
        if (!existing || (!existing.title && title)) {
          byId.set(externalId, {
            externalId,
            title,
            externalUrl: anchor.href.split(/[?#]/)[0],
            thumbnailUrl: existing?.thumbnailUrl ?? thumbnailUrl,
            author: existing?.author ?? author,
            likesCount: 0,
            collectionName: args.collectionName,
            sourcePlatform: args.platform,
          });
        }
      }

      return [...byId.values()].filter((model) => model.title !== "");
    },
    {
      linkPatternSource: options.linkPattern.source,
      collectionName: options.collectionName,
      platform: options.platform,
    }
  );
}
