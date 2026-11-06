"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "./config";

/**
 * Stores the visitor's language choice in the NEXT_LOCALE cookie. Because it
 * is a Server Action that sets a cookie, Next re-renders the current route in
 * the same round trip, so the new language shows without a manual reload.
 *
 * Server Actions are reachable by anyone, so the value is validated against
 * LOCALES and anything else is silently ignored.
 *
 * The cookie is a preference, not a credential: not HttpOnly, not Secure (that
 * would break plain-http LAN use), SameSite=Lax, valid for the whole site.
 */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
}
