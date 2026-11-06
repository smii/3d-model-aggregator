import { afterEach, beforeEach, vi } from "vitest";

// Credentials that adapters and src/lib/crypto.ts read from process.env.
// Blanked for every test so results never depend on the developer's shell or
// .env file; tests that need a value set it explicitly with vi.stubEnv.
const CREDENTIAL_VARS = [
  "THINGIVERSE_APP_TOKEN",
  "CULTS3D_USERNAME",
  "CULTS3D_API_KEY",
  "MYMINIFACTORY_API_KEY",
  "COOKIE_ENCRYPTION_KEY",
] as const;

beforeEach(() => {
  for (const name of CREDENTIAL_VARS) vi.stubEnv(name, undefined);

  // The suite must never reach a real third-party site. Tests that exercise
  // an adapter install their own stub (src/test/http.ts); a test that forgets
  // fails loudly here instead of making a live request.
  vi.stubGlobal("fetch", () =>
    Promise.reject(
      new Error("Unexpected network call in a unit test: stub fetch first."),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
