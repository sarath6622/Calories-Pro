import { describe, it, expect } from "vitest";
import { BCRYPT_COST, hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("produces a bcrypt hash with the configured cost", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$2[ab]\$12\$/);
    expect(BCRYPT_COST).toBe(12);
  });

  it("verifies correct passwords", async () => {
    const hash = await hashPassword("hunter2hunter2");
    expect(await verifyPassword("hunter2hunter2", hash)).toBe(true);
  });

  it("rejects wrong passwords", async () => {
    const hash = await hashPassword("hunter2hunter2");
    expect(await verifyPassword("hunter3hunter3", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const a = await hashPassword("samepass1234");
    const b = await hashPassword("samepass1234");
    expect(a).not.toBe(b);
    expect(await verifyPassword("samepass1234", a)).toBe(true);
    expect(await verifyPassword("samepass1234", b)).toBe(true);
  });
});
