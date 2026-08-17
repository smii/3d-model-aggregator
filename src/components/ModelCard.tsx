"use client";

import { Box, ExternalLink, Heart } from "lucide-react";
import type { SourcePlatform, UnifiedModelResult } from "@/types/model";

// Only Thingiverse's file API resolves to a browser-fetchable (CORS-open)
// STL/3MF URL without requiring the viewer's own session/purchase — see
// src/app/api/preview/route.ts for why the others aren't wired up.
export const PREVIEWABLE_PLATFORMS = new Set<SourcePlatform>(["thingiverse"]);

export const platformBadges: Record<
  SourcePlatform,
  { label: string; className: string }
> = {
  makerworld: { label: "MakerWorld", className: "bg-[#00ae42] text-white" },
  printables: { label: "Printables", className: "bg-[#fa6831] text-white" },
  thingiverse: { label: "Thingiverse", className: "bg-[#248bfb] text-white" },
  cults3d: { label: "Cults3D", className: "bg-[#713bdb] text-white" },
  thangs: { label: "Thangs", className: "bg-[#11bee5] text-zinc-950" },
  crealitycloud: {
    label: "Creality Cloud",
    className: "bg-[#5b67f1] text-white",
  },
  grabcad: { label: "GrabCAD", className: "bg-[#0c7bb3] text-white" },
  myminifactory: {
    label: "MyMiniFactory",
    className: "bg-[#ffc50f] text-zinc-950",
  },
};

function formatPrice(price: { cents: number; currency: string }): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: price.currency,
  }).format(price.cents / 100);
}

interface ModelCardProps {
  model: UnifiedModelResult;
  onToggleSave: (model: UnifiedModelResult) => void;
  onPreview?: (model: UnifiedModelResult) => void;
}

export function ModelCard({ model, onToggleSave, onPreview }: ModelCardProps) {
  const badge = platformBadges[model.sourcePlatform];
  const saved = model.isLikedLocally;
  const previewable = onPreview && PREVIEWABLE_PLATFORMS.has(model.sourcePlatform);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-700">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
        {/* Thumbnails come from arbitrary third-party CDNs, so next/image
            remotePatterns can't enumerate them; use a plain lazy <img>. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={model.thumbnailUrl}
          alt={model.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
          {model.price && (
            <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-semibold text-zinc-950">
              {formatPrice(model.price)}
            </span>
          )}
        </div>
        <div className="absolute right-2 top-2 flex gap-1.5">
          {previewable && (
            <button
              type="button"
              onClick={() => onPreview!(model)}
              aria-label={`Preview ${model.title} in 3D`}
              className="rounded-full bg-zinc-950/70 p-2 text-zinc-300 backdrop-blur-sm transition-colors hover:text-zinc-100"
            >
              <Box className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleSave(model)}
            aria-label={saved ? "Remove from favorites" : "Save to favorites"}
            aria-pressed={saved}
            className={`rounded-full bg-zinc-950/70 p-2 backdrop-blur-sm transition-colors ${
              saved
                ? "text-rose-500 hover:text-rose-400"
                : "text-zinc-300 hover:text-zinc-100"
            }`}
          >
            <Heart className={`size-4 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-between gap-2 p-3">
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-medium text-zinc-100"
            title={model.title}
          >
            {model.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            by {model.author}
          </p>
        </div>
        <a
          href={model.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${model.title} on ${badge.label}`}
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
    </article>
  );
}
