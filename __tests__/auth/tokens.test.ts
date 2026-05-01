import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashToken,
  isExpired,
  tokenExpiry,
} from "@/lib/auth/tokens";

describe("password reset tokens", () => {
  it("generates 64 hex characters of entropy", () => {
    const { token, tokenHash } = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(token).not.toBe(tokenHash);
  });

  it("hashes deterministically with sha256", () => {
    const a = hashToken("abc123");
    const b = hashToken("abc123");
    const c = hashToken("abc124");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("does not store the unhashed token alongside the hash", () => {
    const { token, tokenHash } = generateResetToken();
    expect(hashToken(token)).toBe(tokenHash);
  });
});

describe("token expiry (mocked clock)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires exactly 24 hours after issuance", () => {
    const expires = tokenExpiry();
    expect(expires.getTime() - Date.now()).toBe(RESET_TOKEN_TTL_MS);
    expect(RESET_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("is not expired one minute before the deadline", () => {
    const expires = tokenExpiry();
    vi.setSystemTime(new Date(expires.getTime() - 60 * 1000));
    expect(isExpired(expires)).toBe(false);
  });

  it("is expired exactly at the deadline", () => {
    const expires = tokenExpiry();
    vi.setSystemTime(expires);
    expect(isExpired(expires)).toBe(true);
  });

  it("is expired one minute past the deadline", () => {
    const expires = tokenExpiry();
    vi.setSystemTime(new Date(expires.getTime() + 60 * 1000));
    expect(isExpired(expires)).toBe(true);
  });
});
