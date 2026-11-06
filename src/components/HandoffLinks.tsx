import { ExternalLink } from "lucide-react";
import { getHandoffLinks } from "@/lib/handoff";

interface HandoffLinksProps {
  /** The current search text; the strip renders nothing while it is blank. */
  query: string;
}

/**
 * "Also search on" strip: plain new-tab links to platforms we can't search
 * ourselves (Thangs, Creality Cloud), pre-filled with the query. The browser
 * opens them, never the server -- see src/lib/handoff.ts.
 */
export function HandoffLinks({ query }: HandoffLinksProps) {
  const links = getHandoffLinks(query);
  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-500">Also search on:</span>
      {links.map(({ platform, label, href, prefilled }) => (
        <a
          key={platform}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={
            prefilled
              ? `Search ${label} for "${query.trim()}" in a new tab`
              : `Open ${label} in a new tab (the search isn't pre-filled)`
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 sm:py-1.5"
        >
          {label}
          <ExternalLink className="size-3.5 text-zinc-500" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ))}
    </div>
  );
}
