import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { streamAssistant, type HistoryMessage } from "@/lib/ai/assistant";

const bodySchema = z.object({
  question: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(10_000),
      }),
    )
    .max(20)
    .default([]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const p = await params;
  const id = parseInt(p.id, 10);
  if (Number.isNaN(id) || id <= 0 || String(id) !== p.id) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const ctx = await getCurrentUser();
  if (!ctx) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body", details: parsed.error.issues }, { status: 400 });
  }

  const doc = await prisma.document.findFirst({
    where: { id, ownerId: ctx.user.id },
  });
  if (!doc) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const generator = streamAssistant(
    {
      userId: ctx.user.id,
      locale: ctx.user.locale,
      question: parsed.data.question,
      history: parsed.data.history as HistoryMessage[],
      document: {
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileData: Buffer.from(doc.fileData),
        category: doc.category,
        targetDate: doc.targetDate,
        deadlineType: doc.deadlineType,
        extractionStatus: doc.extractionStatus,
      },
    },
    request.signal,
  );

  (async () => {
    try {
      for await (const chunk of generator) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
    } catch {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ type: "error", code: "UPSTREAM", messageKey: "assistant.errors.upstream" })}\n\n`),
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
