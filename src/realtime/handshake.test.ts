import { describe, expect, it } from "vitest";
import { readTicket } from "@/realtime/handshake";

describe("readTicket", () => {
  it("reads the ticket from the query string", () => {
    expect(readTicket("/ws?ticket=abc")).toBe("abc");
  });

  it("returns null when there is no ticket", () => {
    expect(readTicket("/ws")).toBeNull();
  });

  it("returns null when there is no path", () => {
    expect(readTicket(undefined)).toBeNull();
  });
});
