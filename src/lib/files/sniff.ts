/**
 * The real type of a file, read from its first bytes; null when it is none of these.
 * Never trust file.type, which the client sets. Copied verbatim from Amir's upload action
 * (PR #35), so both uploads can share one sniffer: his action imports it from here.
 */
export function sniffMime(fileBuffer: Buffer): string | null {
  // PDF : %PDF
  if (fileBuffer.subarray(0, 4).toString("hex") === "25504446") {
    return "application/pdf";
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (fileBuffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }
  // JPEG : FF D8 FF
  if (fileBuffer.subarray(0, 3).toString("hex") === "ffd8ff") {
    return "image/jpeg";
  }
  // WEBP : "RIFF" .... "WEBP"
  if (
    fileBuffer.length >= 12 &&
    fileBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    fileBuffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
