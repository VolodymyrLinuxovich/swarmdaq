import { runMission } from "@/lib/orchestrator";
import type { StreamEvent } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const body = await req.json() as { mission?: string; runNumber?: number };
  const { mission, runNumber } = body;

  if (!mission || typeof mission !== "string") {
    return new Response("mission required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runMission(mission.trim(), runNumber, emit);
      } catch (err) {
        emit({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
