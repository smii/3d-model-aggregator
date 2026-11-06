// Catalog registry. Server-side only by convention: it imports every locale, so
// client components must receive their messages through the provider
// (client.tsx) instead of importing this module and bundling all languages.

import type { Locale } from "./config";
import { en, type Catalog, type MessageKey } from "./messages/en";
import { es } from "./messages/es";

/** One entry per locale: a locale added to LOCALES but not registered here fails to compile. */
const CATALOGS: Record<Locale, Catalog> = { en, es };

/** A complete message set: every key has a string. */
export type Messages = Record<MessageKey, string>;

/**
 * The full message set for a locale: its own translations laid over the
 * English source. An absent or empty translation (translation tools export ""
 * for untranslated entries) counts as missing and falls back to English.
 */
export function getMessages(locale: Locale): Messages {
  const catalog = CATALOGS[locale];
  const messages: Messages = { ...en };
  for (const key of Object.keys(en) as MessageKey[]) {
    const translated = catalog[key];
    if (translated && translated.trim() !== "") {
      messages[key] = translated;
    }
  }
  return messages;
}
