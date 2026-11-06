// SPANISH DEMO CATALOG: MACHINE-TRANSLATED, NOT REVIEWED BY A NATIVE SPEAKER.
//
// It exists to prove the i18n plumbing end to end (switcher, cookie, <html lang>,
// fallback). Before presenting Spanish as a supported language, have a Spanish
// speaker review every string for tone, regional variant (neutral vs. Spain vs.
// Latin America) and length: the labels must fit the 11px mobile bottom bar.
// Keys that are missing here render in English (see getMessages in ../catalogs.ts).

import type { Catalog } from "./en";

export const es: Catalog = {
  "nav.search": "Buscar",
  "nav.favorites": "Favoritos",
  "nav.savedSearches": "Búsquedas guardadas",
  "nav.accountSync": "Sincronizar cuentas",
  "nav.settings": "Ajustes",

  "auth.signIn": "Iniciar sesión con Google",
  "auth.signOut": "Cerrar sesión",

  "language.label": "Idioma",
};
