import { describe, expect, it } from "vitest";
import { sniffMime } from "./sniff";

const hex = (signature: string) => Buffer.concat([Buffer.from(signature, "hex"), Buffer.from("rest")]);

describe("sniffMime", () => {
  it.each([
    ["png", hex("89504e470d0a1a0a"), "image/png"],
    ["jpeg", hex("ffd8ffe0"), "image/jpeg"],
    ["webp", Buffer.from("RIFF\0\0\0\0WEBPVP8 "), "image/webp"],
    ["pdf", Buffer.from("%PDF-1.7"), "application/pdf"],
    ["svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), null],
    ["text", Buffer.from("hello"), null],
  ])("%s", (_name, buffer, expected) => {
    expect(sniffMime(buffer)).toBe(expected);
  });
});
