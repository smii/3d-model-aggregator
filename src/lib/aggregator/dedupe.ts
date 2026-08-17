import type { UnifiedModelResult } from '@/types/model';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'of', 'in', 'on', 'by', 'to',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1 && !STOPWORDS.has(word)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Deliberately conservative, and tuned against a real bug found in testing:
// an early version compared raw title words and badly over-matched, because
// several platforms (GrabCAD, Cults3D especially) return terse titles that
// are essentially just the search query itself ("Articulated Dragon" for a
// search of "articulated dragon"). Every result naturally contains the query
// words, so comparing raw titles flagged unrelated designs (a water-dragon
// magnet, a skeleton dragon, a poison dragon...) as duplicates of each other
// just because they all matched the search terms. Fix: strip the query's own
// words out of each title before comparing, so similarity is judged only on
// the *extra* descriptive words -- titles that reduce to nothing but the
// query are never flagged against anything.
const SIMILARITY_THRESHOLD = 0.6;
const MIN_SHARED_WORDS = 1;

/**
 * Flags results whose titles look like the same model reposted on another
 * platform. A heuristic (word-set title similarity, minus the search query's
 * own words), not an exact match -- there's no shared identifier across
 * these platforms to key off of.
 */
export function annotateDuplicates(
  results: UnifiedModelResult[],
  query: string,
): UnifiedModelResult[] {
  const queryWords = tokenize(query);
  const tokenSets = results.map((result) => {
    const titleWords = tokenize(result.title);
    for (const word of queryWords) titleWords.delete(word);
    return titleWords;
  });

  return results.map((result, index) => {
    const alsoFoundOn: { platform: UnifiedModelResult['sourcePlatform']; id: string }[] = [];
    for (let other = 0; other < results.length; other++) {
      if (other === index) continue;
      const candidate = results[other];
      if (candidate.sourcePlatform === result.sourcePlatform) continue;

      let shared = 0;
      for (const word of tokenSets[index]) {
        if (tokenSets[other].has(word)) shared++;
      }
      if (shared < MIN_SHARED_WORDS) continue;
      if (jaccard(tokenSets[index], tokenSets[other]) >= SIMILARITY_THRESHOLD) {
        alsoFoundOn.push({ platform: candidate.sourcePlatform, id: candidate.id });
      }
    }
    return alsoFoundOn.length > 0 ? { ...result, alsoFoundOn } : result;
  });
}
