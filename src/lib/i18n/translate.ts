import type { MessageKey } from "./messages/en";

// Pure translation helpers shared by the server (server.ts) and the client
// provider (client.tsx). No catalogs are imported here, so this module adds
// nothing but a few lines to the client bundle.

export type TParams = Record<string, string | number>;

/** `t("nav.search")`, or with values for {placeholders}: `t("greeting", { name })`. */
export type TFunction = (key: MessageKey, params?: TParams) => string;

/**
 * Replaces {name} placeholders with the matching entry of `params`. A
 * placeholder with no matching param is left as written, which makes a
 * forgotten param visible instead of rendering "undefined".
 */
export function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : placeholder
  );
}

/**
 * Builds a `t()` over a message set. Pass a complete set from getMessages();
 * a key missing from the set renders as the key itself, which is ugly on
 * purpose so it gets noticed.
 */
export function createT(messages: Partial<Record<MessageKey, string>>): TFunction {
  return (key, params) => interpolate(messages[key] ?? key, params);
}
