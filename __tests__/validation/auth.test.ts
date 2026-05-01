import { describe, expect, it } from "vitest";
import {
  ForgotPasswordSchema,
  LoginSchema,
  ResetPasswordSchema,
  SignupSchema,
} from "@/lib/validation/auth";

describe("SignupSchema", () => {
  const valid = {
    name: "Pat",
    email: "Pat@Example.COM",
    password: "longenoughpw",
    confirmPassword: "longenoughpw",
  };

  it("accepts valid input and lowercases the email", () => {
    const parsed = SignupSchema.parse(valid);
    expect(parsed.email).toBe("pat@example.com");
  });

  it("rejects mismatched passwords", () => {
    const result = SignupSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.confirmPassword).toBeDefined();
    }
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = SignupSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid emails", () => {
    expect(SignupSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(SignupSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });
});

describe("LoginSchema", () => {
  it("accepts a valid email + non-empty password", () => {
    expect(LoginSchema.parse({ email: "x@y.io", password: "anything" }).email).toBe("x@y.io");
  });

  it("rejects missing password", () => {
    expect(LoginSchema.safeParse({ email: "x@y.io", password: "" }).success).toBe(false);
  });
});

describe("ForgotPasswordSchema", () => {
  it("requires a valid email", () => {
    expect(ForgotPasswordSchema.parse({ email: "PERSON@example.com" }).email).toBe(
      "person@example.com",
    );
    expect(ForgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("ResetPasswordSchema", () => {
  const valid = { token: "t".repeat(64), password: "longenoughpw", confirmPassword: "longenoughpw" };

  it("accepts a valid payload", () => {
    expect(ResetPasswordSchema.parse(valid).token).toBe(valid.token);
  });

  it("rejects empty tokens", () => {
    expect(ResetPasswordSchema.safeParse({ ...valid, token: "" }).success).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    expect(
      ResetPasswordSchema.safeParse({ ...valid, confirmPassword: "differentpw" }).success,
    ).toBe(false);
  });
});
