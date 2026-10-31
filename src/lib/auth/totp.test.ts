import { describe, expect, it, vi } from "vitest";
import * as OTPAuth from "otpauth";
import { createSecret, generateRecoveryCodes, otpauthUri, verifyCode } from "./totp";

describe("createSecret", () => {
  it("returns a base32 string of 32 characters", () => {
    const secret = createSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(secret.replace(/=/g, "").length).toBeGreaterThanOrEqual(24);
  });

  it("generates different secrets each time", () => {
    expect(createSecret()).not.toBe(createSecret());
  });
});

describe("otpauthUri", () => {
  it("contains the issuer, label and secret", () => {
    const secret = createSecret();
    const uri = otpauthUri(secret, "test@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("MesPapiers");
    expect(uri).toContain("test%40example.com");
    expect(uri).toContain(`secret=${secret}`);
  });
});

describe("verifyCode", () => {
  const secret = createSecret();

  function generateValidCode(offsetSeconds = 0): string {
    const totp = new OTPAuth.TOTP({
      issuer: "MesPapiers",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const now = Date.now() + offsetSeconds * 1000;
    vi.setSystemTime(now);
    const code = totp.generate({ timestamp: now });
    vi.useRealTimers();
    return code;
  }

  it("accepts the current code", () => {
    const code = generateValidCode(0);
    expect(verifyCode(secret, code)).toBe(true);
  });

  it("accepts a code from the previous window", () => {
    const code = generateValidCode(-30);
    expect(verifyCode(secret, code)).toBe(true);
  });

  it("accepts a code from the next window", () => {
    const code = generateValidCode(30);
    expect(verifyCode(secret, code)).toBe(true);
  });

  it("rejects a code two windows out", () => {
    const code = generateValidCode(-90);
    expect(verifyCode(secret, code)).toBe(false);
  });

  it("rejects a garbage string", () => {
    expect(verifyCode(secret, "000000")).toBe(false);
    expect(verifyCode(secret, "abcdef")).toBe(false);
  });
});

describe("generateRecoveryCodes", () => {
  it("produces 10 codes and 10 digests", () => {
    const { codes, digests } = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(digests).toHaveLength(10);
  });

  it("codes are 10-character hex strings", () => {
    const { codes } = generateRecoveryCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{10}$/);
    }
  });

  it("digests are SHA-256 hex", () => {
    const { digests } = generateRecoveryCodes();
    for (const d of digests) {
      expect(d).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("each set is unique", () => {
    const a = generateRecoveryCodes();
    const b = generateRecoveryCodes();
    expect(a.codes).not.toEqual(b.codes);
  });
});
