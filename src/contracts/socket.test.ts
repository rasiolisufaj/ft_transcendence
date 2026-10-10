import { describe, expect, it } from "vitest";
import { parseClientMessage, parseTopic } from "@/contracts/socket";

describe("parseTopic", () => {
  it("reads a channel topic", () => {
    expect(parseTopic("channel:12")).toEqual({ kind: "channel", channelId: 12 });
  });

  it("reads a user topic", () => {
    expect(parseTopic("user:abc")).toEqual({ kind: "user", userId: "abc" });
  });

  it("returns null for an empty string", () => {
    expect(parseTopic("")).toBeNull();
  });

  it("returns null for an invalid channel", () => {
    expect(parseTopic("channel:NaN")).toBeNull();
  });

  it("returns null for a negative channel", () => {
    expect(parseTopic("channel:-1")).toBeNull();
  });

  it("returns null for an empty user", () => {
    expect(parseTopic("user:")).toBeNull();
  });
});

describe("parseClientMessage", () => {
  it("reads a JSON message", () => {
    expect(parseClientMessage('{"type":"subscribe","topic":"channel:12"}')).toEqual({
      type: "subscribe",
      topic: "channel:12",
    });
  });

  it("returns null for something that is not JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    expect(parseClientMessage("42")).toBeNull();
  });

  it("returns null for an unknown message type", () => {
    expect(parseClientMessage('{"type":"publish","topic":"channel:12"}')).toBeNull();
  });

  it("returns null when the topic is missing", () => {
    expect(parseClientMessage('{"type":"subscribe"}')).toBeNull();
  });

  it("returns null for a topic that is neither a channel nor a user", () => {
    expect(parseClientMessage('{"type":"subscribe","topic":"admin"}')).toBeNull();
  });
});
