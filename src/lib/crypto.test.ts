import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "./crypto";

// Throwaway key generated for this test file; it protects nothing real.
const TEST_KEY = randomBytes(32).toString("base64");

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function useKey(key: string = TEST_KEY): void {
  vi.stubEnv("COOKIE_ENCRYPTION_KEY", key);
}

/** Flip every bit of one byte of the decoded payload. */
function tamper(payload: string, index: number): string {
  const bytes = Buffer.from(payload, "base64");
  bytes[index] ^= 0xff;
  return bytes.toString("base64");
}

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a cookie-like JSON string", () => {
    useKey();
    const secret = JSON.stringify([{ name: "session", value: "abc123", domain: ".example.com" }]);

    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it.each([
    ["an empty string", ""],
    ["unicode text", "grüße 日本語 🎲"],
    ["a large payload", "x".repeat(100_000)],
  ])("round-trips %s", (_label, plaintext) => {
    useKey();

    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });

  it("uses a fresh IV each time, so the same plaintext encrypts differently", () => {
    useKey();

    const first = encryptSecret("same input");
    const second = encryptSecret("same input");

    expect(first).not.toBe(second);
    expect(decryptSecret(first)).toBe("same input");
    expect(decryptSecret(second)).toBe("same input");
  });

  it("lays the payload out as iv (12) | auth tag (16) | ciphertext, base64-encoded", () => {
    useKey();
    const plaintext = "layout check";

    const decoded = Buffer.from(encryptSecret(plaintext), "base64");

    expect(decoded.length).toBe(IV_LENGTH + AUTH_TAG_LENGTH + Buffer.byteLength(plaintext, "utf8"));
    // GCM is a stream mode: the ciphertext is exactly as long as the plaintext
    // and must not contain it verbatim.
    expect(decoded.subarray(IV_LENGTH + AUTH_TAG_LENGTH).toString("utf8")).not.toBe(plaintext);
  });

  describe("tampering is detected (GCM authentication)", () => {
    it("throws when a ciphertext byte is changed", () => {
      useKey();
      const payload = encryptSecret("do not tamper with me");

      expect(() => decryptSecret(tamper(payload, IV_LENGTH + AUTH_TAG_LENGTH))).toThrow();
    });

    it("throws when the auth tag is changed", () => {
      useKey();
      const payload = encryptSecret("do not tamper with me");

      expect(() => decryptSecret(tamper(payload, IV_LENGTH))).toThrow();
    });

    it("throws when the IV is changed", () => {
      useKey();
      const payload = encryptSecret("do not tamper with me");

      expect(() => decryptSecret(tamper(payload, 0))).toThrow();
    });

    it("throws when the payload is truncated", () => {
      useKey();
      const decoded = Buffer.from(encryptSecret("do not truncate me"), "base64");

      expect(() => decryptSecret(decoded.subarray(0, decoded.length - 1).toString("base64"))).toThrow();
      expect(() => decryptSecret(decoded.subarray(0, IV_LENGTH).toString("base64"))).toThrow();
    });

    it("throws on input that is not an encrypted payload at all", () => {
      useKey();

      expect(() => decryptSecret("")).toThrow();
      expect(() => decryptSecret("not a real payload")).toThrow();
    });

    it("throws when decrypting with a different key", () => {
      useKey();
      const payload = encryptSecret("encrypted under the first key");

      useKey(randomBytes(32).toString("base64"));

      expect(() => decryptSecret(payload)).toThrow();
    });
  });
});

describe("key validation", () => {
  it("fails with a clear message when COOKIE_ENCRYPTION_KEY is not set", () => {
    // vitest.setup.ts leaves the variable unset.
    expect(() => encryptSecret("x")).toThrow(/COOKIE_ENCRYPTION_KEY is not set/);
    expect(() => decryptSecret("AAAA")).toThrow(/COOKIE_ENCRYPTION_KEY is not set/);
  });

  it.each([
    ["16 bytes", 16],
    ["31 bytes", 31],
    ["33 bytes", 33],
    ["64 bytes", 64],
  ])("rejects a key that decodes to %s instead of 32", (_label, length) => {
    useKey(randomBytes(length).toString("base64"));

    expect(() => encryptSecret("x")).toThrow(/exactly 32 bytes/);
    expect(() => decryptSecret("AAAA")).toThrow(/exactly 32 bytes/);
  });

  it("rejects a hex-encoded 32-byte key, which is not valid 32-byte base64", () => {
    useKey(randomBytes(32).toString("hex"));

    expect(() => encryptSecret("x")).toThrow(/exactly 32 bytes/);
  });

  it("does not echo the key in its error messages", () => {
    const badKey = randomBytes(16).toString("base64");
    useKey(badKey);

    let message = "";
    try {
      encryptSecret("x");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toBe("");
    expect(message).not.toContain(badKey);
  });
});
