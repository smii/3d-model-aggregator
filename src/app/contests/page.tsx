import type { Metadata } from "next";
import { Gift, Trophy, TriangleAlert } from "lucide-react";
import {
  getContests,
  STATIC_CONTEST_LINKS,
  type Contest,
  type ContestLink,
} from "@/lib/contests";
import type { SourcePlatform } from "@/types/model";

export const metadata: Metadata = {
  title: "Contests | 3D Model Aggregator",
};

// Rendered on the server for every request; the hourly revalidation lives in
// the fetch layer (fetchContestJson), not here, because the root layout reads
// the session and so the page itself is never statically cached.

const PLATFORM_LABELS = new Map<SourcePlatform, string>(
  STATIC_CONTEST_LINKS.map((link) => [link.platform, link.label]),
);

function platformLabel(platform: SourcePlatform): string {
  return PLATFORM_LABELS.get(platform) ?? platform;
}

// Fixed zone and absolute times: relative labels ("5 days left") would go
// stale in HTML the service worker may serve from its cache while offline.
const utcFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatUtc(iso: string): string {
  return `${utcFormat.format(new Date(iso))} UTC`;
}

function linkHint(link: ContestLink): string {
  if (!link.verified) {
    return "Contests page not verified. Opens the home page.";
  }
  const { host, pathname } = new URL(link.url);
  return `${host}${pathname === "/" ? "" : pathname}`;
}

function OutboundCard({ link }: { link: ContestLink }) {
  const text = link.verified
    ? `Browse contests on ${link.label}`
    : `Visit ${link.label}`;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${text} (opens in a new tab)`}
      className="flex h-full min-h-16 flex-col justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
    >
      <span className="font-medium text-zinc-100">
        {text} <span aria-hidden="true">↗</span>
      </span>
      <span className="break-all text-xs text-zinc-500">{linkHint(link)}</span>
    </a>
  );
}

function LiveContestCard({ contest }: { contest: Contest }) {
  return (
    <a
      href={contest.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
    >
      {contest.imageUrl && (
        <>
          {/* Images come from arbitrary third-party CDNs, so next/image
              remotePatterns can't enumerate them; use a plain lazy <img>. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contest.imageUrl}
            alt=""
            loading="lazy"
            className="size-20 shrink-0 rounded-lg bg-zinc-800 object-cover"
          />
        </>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium text-zinc-400">
          {platformLabel(contest.platform)}
          {contest.status === "upcoming" ? " · Upcoming" : ""}
        </span>
        <span className="line-clamp-2 font-medium text-zinc-100">
          {contest.title}
        </span>
        {contest.prize && (
          <span className="flex items-start gap-1.5 text-sm text-amber-300">
            <Gift className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{contest.prize}</span>
          </span>
        )}
        {contest.deadline && (
          <span className="text-xs text-zinc-400">
            Closes{" "}
            <time dateTime={contest.deadline}>{formatUtc(contest.deadline)}</time>
          </span>
        )}
      </div>
    </a>
  );
}

export default async function ContestsPage() {
  const feed = await getContests();
  const hasLiveSources = feed.sourceCount > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Trophy className="size-6 text-amber-400" />
          Contests
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Design contests and challenges run by the 3D printing platforms.
        </p>
      </div>

      {feed.failures.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>
            Couldn&apos;t load live contests from{" "}
            {feed.failures
              .map(({ platform, error }) => `${platformLabel(platform)} (${error})`)
              .join(" · ")}
            .
          </p>
        </div>
      )}

      {hasLiveSources && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Open now</h2>
            <p className="text-xs text-zinc-500">
              As of{" "}
              <time dateTime={feed.fetchedAt}>{formatUtc(feed.fetchedAt)}</time>
              . Check the platform for the final word on deadlines.
            </p>
          </div>
          {feed.contests.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {feed.contests.map((contest) => (
                <li key={contest.url}>
                  <LiveContestCard contest={contest} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-400">
              No open contests reported by the live sources right now.
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Browse contests on each platform
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {hasLiveSources
              ? "Every platform runs more contests than the live list above covers. These links open the platform's own page in a new tab."
              : "None of these platforms offers a public contest feed this app can use, so there are no live listings here. These links open the platform's own page in a new tab."}
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STATIC_CONTEST_LINKS.map((link) => (
            <li key={link.platform}>
              <OutboundCard link={link} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
