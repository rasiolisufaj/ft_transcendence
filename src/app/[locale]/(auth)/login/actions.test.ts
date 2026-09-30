import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { login } from "./actions";

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [name, value] of Object.entries(fields)) f.set(name, value);
  return f;
}

describe("login", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers with the shared schema's error keys", async () => {
    expect(await login({}, form({ email: "nope", password: "" }))).toEqual({
      fieldErrors: { email: ["emailInvalid"], password: ["passwordRequired"] },
    });
  });

  it("locks an email for 15 minutes after 6 failures", async () => {
    // Unknown email: the limiter runs before the lookup, so no user is needed.
    const attempt = form({ email: `test-${randomUUID()}@mespapiers.test`, password: "wrong" });

    for (let i = 0; i < 6; i++) {
      expect(await login({}, attempt)).toEqual({ error: "invalidCredentials" });
    }
    expect(await login({}, attempt)).toEqual({ error: "tooManyAttempts" });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 15 * 60 * 1000 + 1);
    expect(await login({}, attempt)).toEqual({ error: "invalidCredentials" });
  });
});
