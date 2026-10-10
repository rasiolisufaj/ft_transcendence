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
		const channelId = Number(id);
		if (!channelId || channelId < 0) {
			return null;
		}
		return { kind: "channel", channelId };
	}
	if (kind === "user") {
		if (!id) {
			return null;
		}
		return { kind: "user", userId: id };
	}
	return null;
}

export function parseClientMessage(raw: string) {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
