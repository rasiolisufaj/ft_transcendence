import { parseTopic } from "@/contracts/socket";


export function readTicket(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  const url = new URL(path, "http://localhost");
  return url.searchParams.get("ticket");
}

// Default-deny: a user topic only for its owner; channel topics wait for the membership check.
export function canSubscribe(userId: string, topic: string): boolean {
  const parsed = parseTopic(topic);
  if (!parsed) {
    return false;
  }
  if (parsed.kind === "user") {
    return parsed.userId === userId;
  }
  return false;
}
