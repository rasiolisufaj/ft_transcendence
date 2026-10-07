// server -> browser
export type ServerMessage =
	| { type: "hello"; userId: string }
	| { type: "subscribed"; topic: string }
	| { type: "unsubscribed"; topic: string }
	| { type: "error"; code: "badRequest" | "forbidden"; topic?: string };

// browser -> server
export type ClientMessage =
	| { type: "subscribe"; topic: string }
	| { type: "unsubscribe"; topic: string };

export function parseTopic(name: string) {
	const parts = name.split(":");
	const kind = parts[0];
	const id = parts[1];
	
	if (kind === "channel") {
		return { kind: "channel", channelId: Number(id) };
	}
	if (kind === "user") {
		return { kind: "user", userId: id };
	}
	return null;
}