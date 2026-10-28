import { z } from "zod";
import type { RealtimeEvent } from "./events";

// server -> browser
export type ServerMessage =
	| { type: "hello"; userId: string }
	| { type: "subscribed"; topic: string }
	| { type: "unsubscribed"; topic: string }
	| { type: "error"; code: "badRequest" | "forbidden"; topic?: string }
	| { type: "event"; topic: string; event: RealtimeEvent }
	| { type: "presence"; userId: string; online: boolean };

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
		return { kind: "channel" as const, channelId };
	}
	if (kind === "user") {
		if (!id) {
			return null;
		}
		return { kind: "user" as const, userId: id };
	}
	return null;
}

const topicSchema = z.string().max(100).regex(/^(channel:[1-9]\d*|user:[A-Za-z0-9_-]+)$/);

const clientMessageSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("subscribe"), topic: topicSchema }),
	z.object({ type: z.literal("unsubscribe"), topic: topicSchema }),
]);

export function parseClientMessage(raw: string): ClientMessage | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}

	const result = clientMessageSchema.safeParse(data);
	if (!result.success) {
		return null;
	}
	return result.data;
}

const publishBodySchema = z.object({
	topic: topicSchema,
	event: z.looseObject({ type: z.string() }),
});

export type PublishBody = z.infer<typeof publishBodySchema>;

export function parsePublishBody(raw: string): PublishBody | null {
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return null;
	}

	const result = publishBodySchema.safeParse(data);
	if (!result.success) {
		return null;
	}
	return result.data;
}
