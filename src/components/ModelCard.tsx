"use client";

import { useRef, useState } from "react";
import { Box, ChevronLeft, ChevronRight, Copy, Heart } from "lucide-react";
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

const SWIPE_THRESHOLD_PX = 40;

// Click arrows (desktop) + touch swipe (mobile/PWA) through a result's image
// gallery. Only Printables, Cults3D, and MyMiniFactory return more than one
// image per result in search — everywhere else model.images is a single
// entry and this renders as a plain static image (no arrows/dots).
function ImageSlider({ title, images }: { title: string; images: string[] }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // Set when a horizontal swipe just changed the photo, so the synthetic
  // click browsers fire after touchend doesn't bubble up to the card's
  // whole-card navigation. A plain tap (no swipe) should still navigate.
  const justSwiped = useRef(false);

  if (images.length === 0) return null;

  function goTo(next: number) {
    setIndex((next + images.length) % images.length);
  }

  return (
    <div
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        justSwiped.current = false;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (delta > SWIPE_THRESHOLD_PX) {
          goTo(index - 1);
          justSwiped.current = true;
        } else if (delta < -SWIPE_THRESHOLD_PX) {
          goTo(index + 1);
          justSwiped.current = true;
        }
        touchStartX.current = null;
      }}
      onClickCapture={(e) => {
        if (justSwiped.current) {
          justSwiped.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="absolute inset-0"
    >
      {/* Thumbnails come from arbitrary third-party CDNs, so next/image
          remotePatterns can't enumerate them; use a plain lazy <img>. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={title}
        loading="lazy"
        className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index - 1);
            }}
            aria-label="Previous image"
            className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-zinc-950/70 p-1 text-zinc-300 opacity-0 backdrop-blur-sm transition-opacity hover:text-zinc-100 group-hover:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index + 1);
            }}
            aria-label="Next image"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-zinc-950/70 p-1 text-zinc-300 opacity-0 backdrop-blur-sm transition-opacity hover:text-zinc-100 group-hover:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-1">
            {images.map((image, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                aria-label={`Go to image ${i + 1}`}
                className={`size-1.5 rounded-full transition-colors ${
                  i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface ModelCardProps {
  model: UnifiedModelResult;
  onToggleSave: (model: UnifiedModelResult) => void;
  onPreview?: (model: UnifiedModelResult) => void;
  onTagClick?: (tag: string) => void;
  selectedTags?: ReadonlySet<string>;
}

export function ModelCard({
  model,
  onToggleSave,
  onPreview,
  onTagClick,
  selectedTags,
}: ModelCardProps) {
  const badge = platformBadges[model.sourcePlatform];
  const saved = model.isLikedLocally;
  const previewable = onPreview && PREVIEWABLE_PLATFORMS.has(model.sourcePlatform);

  // Opening the model in a new tab, matching the card's existing external
  // link behavior. Clicks on any real link or button inside the card (title,
  // platform badges, save/preview/tags, gallery controls) are handled by
  // those elements and must not trigger whole-card navigation.
  function openExternal() {
    window.open(model.externalUrl, "_blank", "noopener,noreferrer");
  }

  // Desktop drag-select (mousedown + move + mouseup) fires a click on mouseup;
  // track it so whole-card navigation doesn't open the model mid-selection.
  // Mirrors ImageSlider's `justSwiped` touch guard, consumed by the handler
  // below. SWIPE_THRESHOLD_PX is module-scoped, so it's shared with that guard.
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const justDragged = useRef(false);

  return (
    <article
      onMouseDown={(e) => {
        justDragged.current = false;
        dragStart.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={(e) => {
        if (dragStart.current) {
          const moved =
            Math.abs(e.clientX - dragStart.current.x) +
            Math.abs(e.clientY - dragStart.current.y);
          if (moved > SWIPE_THRESHOLD_PX) justDragged.current = true;
          dragStart.current = null;
        }
      }}
      onClick={(e) => {
        if (justDragged.current) {
          justDragged.current = false;
          return;
        }
        // Middle-click (autoscroll) and right-click (context menu) fall
        // through rather than hijacking browser behavior; only primary and
        // middle clicks navigate (both open a new tab, target=_blank style).
        if (e.button !== 0 && e.button !== 1) return;
        if ((e.target as HTMLElement).closest("a, button")) return;
        openExternal();
      }}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 transition-colors hover:border-zinc-700 cursor-pointer"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
        <ImageSlider
          title={model.title}
          images={model.images.length > 0 ? model.images : [model.thumbnailUrl]}
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

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3
            className="truncate text-sm font-medium text-zinc-100"
            title={model.title}
          >
            {/* Title doubles as the keyboard-accessible target for opening
                the model, since whole-card navigation is mouse/touch-only. */}
            <a
              href={model.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-indigo-300 focus-visible:outline-none"
            >
              {model.title}
            </a>
          </h3>
          <p className="mt-0.5 truncate text-xs text-zinc-400">
            by {model.author} · {model.license}
          </p>
        </div>

        {model.tags.length > 0 && onTagClick && (
          <div className="flex flex-wrap gap-1">
            {model.tags.slice(0, 5).map((tag) => {
              const active = selectedTags?.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagClick(tag)}
                  className={`rounded-md px-1.5 py-0.5 text-[11px] transition-colors ${
                    active
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {model.mergedPlatforms && model.mergedPlatforms.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <Copy className="size-3 shrink-0 text-zinc-500" />
            {model.mergedPlatforms.map((copy) => (
              <a
                key={copy.platform}
                href={copy.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`${copy.likesCount} likes on ${platformBadges[copy.platform].label}`}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 ${platformBadges[copy.platform].className}`}
              >
                {platformBadges[copy.platform].label}
              </a>
            ))}
          </div>
        )}

        {!model.mergedPlatforms && model.alsoFoundOn && model.alsoFoundOn.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Copy className="size-3 shrink-0" />
            Also on{" "}
            {model.alsoFoundOn
              .map((match) => platformBadges[match.platform].label)
              .join(", ")}
          </p>
        )}
      </div>
    </article>
  );
}
