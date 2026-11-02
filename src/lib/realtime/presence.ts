import type { ServerMessage } from "@/contracts/socket";

export type OnlineFriends = ReadonlySet<string> | null;

export function applyPresence(current: OnlineFriends, message: ServerMessage): OnlineFriends {
  if (message.type === "hello") {
    return new Set();
  }
  if (message.type !== "presence" || !current) {
    return current;
  }
  const next = new Set(current);
  if (message.online) {
    next.add(message.userId);
  } else {
    next.delete(message.userId);
  }
  return next;
}
