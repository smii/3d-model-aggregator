import type { SourcePlatform } from '@/types/model';

export interface ContestLink {
  platform: SourcePlatform;
  /** Display name. Local on purpose: platformBadges lives in a client module. */
  label: string;
  /** The platform's contests page when `verified`, otherwise its site root. */
  url: string;
  /**
   * True only when `url` is a contest listing page that was confirmed to exist
   * (Wayback snapshot with HTTP 200, see docs/plans/research/phase-4-contests.md).
   * The platforms' own pages answer automated requests with a bot challenge,
   * so none could be read directly. Unverified entries fall back to the site
   * root rather than guessing a path.
   */
  verified: boolean;
}

/**
 * Curated outbound links, the fallback that always works: plain hrefs, no
 * scraping. Shown for every platform even when it also has a live feed.
 * Verified entries first.
 */
export const STATIC_CONTEST_LINKS: readonly ContestLink[] = [
  {
    platform: 'makerworld',
    label: 'MakerWorld',
    url: 'https://makerworld.com/en/contests',
    verified: true,
  },
  {
    platform: 'printables',
    label: 'Printables',
    url: 'https://www.printables.com/contest',
    verified: true,
  },
  {
    platform: 'thingiverse',
    label: 'Thingiverse',
    url: 'https://www.thingiverse.com/challenges',
    verified: true,
  },
  {
    platform: 'cults3d',
    label: 'Cults3D',
    url: 'https://cults3d.com/en/contests',
    verified: true,
  },
  {
    platform: 'crealitycloud',
    label: 'Creality Cloud',
    url: 'https://www.crealitycloud.com/contest',
    verified: true,
  },
  // Candidate https://www.myminifactory.com/competitions is search-indexed only.
  {
    platform: 'myminifactory',
    label: 'MyMiniFactory',
    url: 'https://www.myminifactory.com/',
    verified: false,
  },
  // Candidate https://grabcad.com/challenges: Wayback answered 202 (inconclusive).
  {
    platform: 'grabcad',
    label: 'GrabCAD',
    url: 'https://grabcad.com/',
    verified: false,
  },
  // No Thangs contest listing URL could be found at all.
  {
    platform: 'thangs',
    label: 'Thangs',
    url: 'https://thangs.com/',
    verified: false,
  },
];
