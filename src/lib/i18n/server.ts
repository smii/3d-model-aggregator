import { cookies, headers } from "next/headers";
import { getMessages, type Messages } from "./catalogs";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { negotiateLocale } from "./negotiate";
import { createT, type TFunction } from "./translate";

// Server-side entry point (server components, route handlers, server actions).
// Client components must not import this file: they use useT() from client.tsx.

/**
 * The locale for the current request: a valid NEXT_LOCALE cookie wins, then the
 * Accept-Language header, then English. An unknown cookie value is ignored as if
 * the cookie were absent, so tampered or stale values can never select anything
 * that is not in LOCALES.
 *
 * Reads request cookies and headers, which makes the calling route dynamic.
 * (The root layout is already dynamic because the header calls auth().)
 */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return negotiateLocale((await headers()).get("accept-language"));
}

/** The request's locale plus its complete message set and a bound `t()`. */
export async function getI18n(): Promise<{
  locale: Locale;
  messages: Messages;
  t: TFunction;
}> {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return { locale, messages, t: createT(messages) };
}

/** Shorthand for server components that only need `t()`: `const t = await getT();` */
export async function getT(): Promise<TFunction> {
  return (await getI18n()).t;
}
