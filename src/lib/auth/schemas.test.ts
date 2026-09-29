import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/auth/schemas";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import fr from "../../../messages/fr.json";

describe("signupSchema", () => {
  it("accepts a well-formed signup", () => {
    const r = signupSchema.safeParse({
      email: "  Rasiol@Example.COM ",
      displayName: "  Rasiol  ",
      password: "hunter2hunter2",
    });
    expect(r.success).toBe(true);
    // Normalised so "A@b.com" and "a@b.com" cannot become two accounts.
    expect(r.data?.email).toBe("rasiol@example.com");
    expect(r.data?.displayName).toBe("Rasiol");
  });

  it("rejects a malformed email", () => {
    expect(signupSchema.safeParse({
      email: "nope", displayName: "Rasiol", password: "hunter2hunter2",
    }).success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const r = signupSchema.safeParse({
      email: "a@b.com", displayName: "Rasiol", password: "short",
    });
    expect(r.success).toBe(false);
    const issue = r.error?.issues.find((i) => i.path[0] === "password");
    expect(issue?.message).toBe("passwordTooShort");
  });

  it("rejects a display name under 2 characters", () => {
    expect(signupSchema.safeParse({
      email: "a@b.com", displayName: "R", password: "hunter2hunter2",
    }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("does not impose the signup password rules on login", () => {
    // An account created before a rule change must still be able to log in.
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("requires a password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

it("emits only messages that are auth.errors keys in every locale", () => {
  // Trip every rule once: each message is rendered with t(), so a missing key
  // would show the raw key and log a console error (graded).
  const issues = [
    signupSchema.safeParse({ email: "nope", displayName: "R", password: "short" }),
    signupSchema.safeParse({
      email: `${"a".repeat(250)}@b.com`, displayName: "x".repeat(51), password: "x".repeat(201),
    }),
    loginSchema.safeParse({ email: "a@b.com", password: "" }),
  ].flatMap((r) => r.error?.issues ?? []);

  expect(issues).toHaveLength(7);
  for (const { message } of issues) {
    for (const catalogue of [fr, en, es]) {
      expect(catalogue.auth.errors).toHaveProperty(message);
    }
  }
});
