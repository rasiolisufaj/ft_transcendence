import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH, sendMessageSchema } from "@/lib/messages/schemas";

const errorOf = (input: unknown) => {
  const result = sendMessageSchema.safeParse(input);
  return result.success ? null : result.error.issues[0]?.message;
};

describe("sendMessageSchema", () => {
  it("trims the message", () => {
    expect(sendMessageSchema.parse({ userId: "bob", content: "  Salut  " })).toEqual({
      userId: "bob",
      content: "Salut",
    });
  });

  it("refuses an empty message", () => {
    expect(errorOf({ userId: "bob", content: "   " })).toBe("empty");
  });

  it("refuses a message that is too long", () => {
    expect(errorOf({ userId: "bob", content: "x".repeat(MAX_MESSAGE_LENGTH + 1) })).toBe("tooLong");
  });

  it("accepts a message of the maximum length", () => {
    expect(errorOf({ userId: "bob", content: "x".repeat(MAX_MESSAGE_LENGTH) })).toBeNull();
  });

  it("refuses a missing recipient", () => {
    expect(sendMessageSchema.safeParse({ content: "Salut" }).success).toBe(false);
  });
});
