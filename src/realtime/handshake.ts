import { parseTopic } from "@/contracts/socket";


export function readTicket(path: string | undefined): string | null {
  if (!path) {
    return null;
  }
  const url = new URL(path, "http://localhost");
  return url.searchParams.get("ticket");
}

export type IsMember = (userId: string, channelId: number) => Promise<boolean>;

export async function canSubscribe(userId: string, topic: string, isMember: IsMember): Promise<boolean> {
  const parsed = parseTopic(topic);
  if (!parsed) {
    return false;
  }
  if (parsed.kind === "user") {
    return parsed.userId === userId;
  }
  return isMember(userId, parsed.channelId);
}
