// Multi-provider LLM routing — SERVER ONLY (imports weave, openai, @anthropic-ai/sdk)
// For client-safe constants (AGENT_PROVIDER, PROVIDER_LABELS, PROVIDER_COLORS)
// import from "./providers-config" instead.

export type { LLMProvider } from "./providers-config";
export { AGENT_PROVIDER, PROVIDER_LABELS, PROVIDER_COLORS } from "./providers-config";

// ── OpenAI generation ────────────────────────────────────────────────────────

export async function generateWithOpenAI(params: {
  agentName: string;
  role: string;
  task: string;
  mission: string;
  context?: string;
  tokenAccumulator: { input: number; output: number };
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const { OpenAI } = await import("openai");
  let client = new OpenAI({ apiKey });

  if (process.env.WANDB_API_KEY) {
    try {
      const weave = await import("weave");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client = weave.wrapOpenAI(client as any) as unknown as InstanceType<typeof OpenAI>;
    } catch { /* continue without Weave wrapping */ }
  }

  const systemPrompt = `You are ${params.agentName}, an AI agent with the role: ${params.role}.
You are participating in a multi-agent swarm working on a mission.
Be specific, actionable, and professional. Format with markdown headers.`;

  const userPrompt = `Mission: ${params.mission}
Task: ${params.task}
${params.context ? `Context:\n${params.context}` : ""}

Provide your expert analysis and output. Be specific with numbers, examples, and actionable recommendations.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt },
    ],
    max_tokens: 600,
  });

  params.tokenAccumulator.input  += response.usage?.prompt_tokens     ?? 0;
  params.tokenAccumulator.output += response.usage?.completion_tokens ?? 0;

  return response.choices[0]?.message?.content ?? "";
}

// ── Anthropic generation ─────────────────────────────────────────────────────

export async function generateWithAnthropic(params: {
  agentName: string;
  role: string;
  task: string;
  mission: string;
  context?: string;
  tokenAccumulator: { input: number; output: number };
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are ${params.agentName}, an AI agent with the role: ${params.role}.
You are participating in a multi-agent swarm working on a mission.
Be specific, actionable, and professional. Format with markdown headers.`;

  const userPrompt = `Mission: ${params.mission}
Task: ${params.task}
${params.context ? `Context:\n${params.context}` : ""}

Provide your expert analysis and output. Be specific with numbers, examples, and actionable recommendations.`;

  // Manual Weave op wrapping for Anthropic (SDK-level wrapping not yet in weave-js)
  let weaveOp: ((fn: () => Promise<string>) => Promise<string>) | null = null;
  if (process.env.WANDB_API_KEY) {
    try {
      const weave = await import("weave");
      const opName = `${params.agentName}.${params.task.replace(/ /g, "_")}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const wrappedOp = weave.op(async (fn: () => Promise<string>) => fn(), { name: opName } as any);
      weaveOp = (fn) => wrappedOp(fn);
    } catch { /* continue without tracing */ }
  }

  const run = async () => {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    params.tokenAccumulator.input  += response.usage?.input_tokens  ?? 0;
    params.tokenAccumulator.output += response.usage?.output_tokens ?? 0;

    return response.content[0]?.type === "text" ? response.content[0].text : "";
  };

  return weaveOp ? await weaveOp(run) : await run();
}
