import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

export interface WeaveCall {
  id: string;
  op_name: string;
  started_at: string;
  ended_at: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
}

export interface TraceSummary {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs: number;
  calls: WeaveCall[];
}

function parseTokens(summary: Record<string, unknown>): { input: number; output: number; model: string } {
  // Weave usage summary shape: { usage: { "model-name": { input_tokens, output_tokens, ... } } }
  const usage = summary?.usage as Record<string, unknown> | undefined;
  if (!usage) return { input: 0, output: 0, model: "gemini" };

  for (const [key, val] of Object.entries(usage)) {
    if (typeof val === "object" && val !== null) {
      const u = val as Record<string, number>;
      return {
        input: u.input_tokens ?? u.prompt_tokens ?? 0,
        output: u.output_tokens ?? u.completion_tokens ?? 0,
        model: key.replace("google_genai", "gemini-2.5-flash"),
      };
    }
  }
  return { input: 0, output: 0, model: "gemini" };
}

function parseOpName(opName: string): string {
  // weave:///entity/project/op/google_genai.GenerativeModel.generate_content:abc123
  const parts = opName.split("/");
  const raw = parts[parts.length - 1] ?? opName;
  const clean = raw.split(":")[0];
  if (clean.includes("generate_content")) return "generate_content";
  if (clean.includes("generateContent")) return "generateContent";
  return clean.slice(0, 40);
}

export async function GET() {
  const apiKey = process.env.WANDB_API_KEY;
  const entity = process.env.WANDB_ENTITY ?? "vborysenko-uc-berkeley";
  const project = process.env.WANDB_PROJECT ?? "swarmdaq";

  if (!apiKey) {
    return NextResponse.json({ totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, avgLatencyMs: 0, calls: [] });
  }

  try {
    const auth = Buffer.from(`api:${apiKey}`).toString("base64");

    const res = await fetch("https://trace.wandb.ai/calls/query", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: `${entity}/${project}`,
        filter: {},
        limit: 30,
        sort_by: [{ field: "started_at", direction: "desc" }],
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error("[traces] Weave API error:", res.status, await res.text().catch(() => ""));
      return NextResponse.json({ totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, avgLatencyMs: 0, calls: [] });
    }

    const data = await res.json() as { calls?: unknown[] };
    const rawCalls = data.calls ?? [];

    const calls: WeaveCall[] = rawCalls.map((c: unknown) => {
      const call = c as Record<string, unknown>;
      const startedAt = call.started_at as string ?? "";
      const endedAt = call.ended_at as string | null ?? null;
      const latencyMs = startedAt && endedAt
        ? Math.round(new Date(endedAt).getTime() - new Date(startedAt).getTime())
        : 0;
      const summary = (call.summary as Record<string, unknown>) ?? {};
      const { input, output, model } = parseTokens(summary);

      return {
        id: call.id as string ?? "",
        op_name: parseOpName((call.op_name as string) ?? ""),
        started_at: startedAt,
        ended_at: endedAt,
        latencyMs,
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output,
        model,
      };
    });

    const totalInputTokens = calls.reduce((s, c) => s + c.inputTokens, 0);
    const totalOutputTokens = calls.reduce((s, c) => s + c.outputTokens, 0);
    const latencies = calls.filter((c) => c.latencyMs > 0).map((c) => c.latencyMs);
    const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0;

    const summary: TraceSummary = {
      totalCalls: calls.length,
      totalInputTokens,
      totalOutputTokens,
      avgLatencyMs,
      calls: calls.slice(0, 10),
    };

    return NextResponse.json(summary);
  } catch (err) {
    console.error("[traces] fetch error:", err);
    return NextResponse.json({ totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, avgLatencyMs: 0, calls: [] });
  }
}
