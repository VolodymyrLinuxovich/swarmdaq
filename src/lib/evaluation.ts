import type { Agent, EvalScore } from "./types";
import { clamp01 } from "./math/agentMath";

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Weighted overall score ────────────────────────────────────────────────────

export function computeOverall(dims: Omit<EvalScore, "overall">): number {
  return Math.round(
    dims.factuality * 0.20 +
    dims.quality * 0.20 +
    dims.usefulness * 0.18 +
    dims.specificity * 0.15 +
    dims.actionability * 0.15 +
    dims.collaboration * 0.12
  );
}

// ── Parse structured JSON from LLM text ──────────────────────────────────────

export function parseStructuredEval(text: string): EvalScore | null {
  try {
    // Try to extract JSON object from the text
    const jsonMatch = text.match(/\{[^{}]*"quality"[^{}]*\}/) ??
                      text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const dims: Omit<EvalScore, "overall"> = {
      quality: parsed.quality,
      factuality: parsed.factuality,
      usefulness: parsed.usefulness,
      specificity: parsed.specificity,
      actionability: parsed.actionability,
      collaboration: parsed.collaboration,
    };

    // All 6 dims must be present and numeric
    for (const val of Object.values(dims)) {
      if (typeof val !== "number" || isNaN(val)) return null;
    }

    return {
      ...dims,
      overall: computeOverall(dims),
    };
  } catch {
    return null;
  }
}

// ── Content-based local rubric ────────────────────────────────────────────────

export function computeLocalRubric(
  outputs: Record<string, string>,
  selectedAgents: Agent[]
): EvalScore {
  const allText = Object.entries(outputs)
    .filter(([key]) => key !== "final_eval")
    .map(([, v]) => v)
    .join("\n");

  const agentIds = selectedAgents.map((a) => a.id);

  // ── Factuality ──
  const hasCitations = /HolonIQ|MLH \d{4}|verified.*source|n=\d{2,}/i.test(allText);
  const hasUnverifiedFlag = /without source|needs.*verif|requires.*verif|claim.*speculative/i.test(allText);
  const hasSourceVerifier = agentIds.includes("source_verifier");

  let factuality = 68;
  if (hasCitations) factuality += 18;
  if (hasSourceVerifier) factuality += 8;
  if (hasUnverifiedFlag) factuality -= 18;
  factuality = clamp(factuality, 40, 97);

  // ── Quality ──
  const headerCount = (allText.match(/^#{1,3} /gm) ?? []).length;
  const bulletCount = (allText.match(/^[*-] /gm) ?? []).length;
  const wordCount = allText.split(/\s+/).filter(Boolean).length;
  const hasSkeptic = agentIds.includes("skeptic");

  let quality = 62;
  quality += Math.min(headerCount * 3, 15);
  quality += Math.min(bulletCount * 1.5, 12);
  quality += wordCount > 1200 ? 10 : wordCount > 600 ? 5 : 0;
  if (hasSkeptic) quality += 5;
  quality = clamp(quality, 40, 97);

  // ── Specificity ──
  const specificNumbers = (allText.match(/\d+[%$KMB]|\$[\d.]+[MBK]|\d+\.\d+x|\bn=\d+/g) ?? []).length;
  const hasNamedEntities = /MLH|HolonIQ|MIT|Stanford|ChatGPT|Notion|OpenAI|Anthropic/i.test(allText);
  const pitchOutput = outputs["pitch_script"] ?? "";
  const pitchHasNumbers = /\d+[%$KMB]|\$[\d.]+[MBK]|\d+\.\d+x|\bn=\d+/.test(pitchOutput);

  let specificity = 58;
  specificity += Math.min(specificNumbers * 3, 22);
  if (hasNamedEntities) specificity += 10;
  if (pitchHasNumbers) specificity += 6;
  specificity = clamp(specificity, 40, 97);

  // ── Actionability ──
  const pitchHasHook = /raise your hand|last week|three months ago|\[0-\d+s\]/i.test(pitchOutput);
  const hasNextSteps = /next step|timeline|recommend|by month|action item/i.test(allText);
  const hasMitigations = /mitigation:|mitigate|countermeasure/i.test(allText);

  let actionability = 64;
  if (pitchHasHook) actionability += 12;
  if (hasNextSteps) actionability += 10;
  if (hasMitigations) actionability += 8;
  actionability = clamp(actionability, 40, 97);

  // ── Usefulness ──
  const usefulness = clamp(Math.round((quality + specificity + actionability) / 3) - 2, 40, 97);

  // ── Collaboration ──
  const numAgents = selectedAgents.length;
  const hasSourceAndSkeptic = hasSourceVerifier && hasSkeptic;

  let collaboration = 62;
  collaboration += numAgents >= 5 ? 14 : numAgents >= 4 ? 8 : 4;
  collaboration += hasSourceAndSkeptic ? 8 : hasSourceVerifier || hasSkeptic ? 4 : 0;
  collaboration = clamp(collaboration, 40, 97);

  const dims: Omit<EvalScore, "overall"> = {
    quality,
    factuality,
    usefulness,
    specificity,
    actionability,
    collaboration,
  };

  return {
    ...dims,
    overall: computeOverall(dims),
  };
}

// ── LLM-based evaluation ──────────────────────────────────────────────────────

export async function evaluateWithLLM(
  mission: string,
  outputs: Record<string, string>,
  selectedAgents: Agent[]
): Promise<EvalScore | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const genAI = new GoogleGenAI({ apiKey });

    const agentNames = selectedAgents.map((a) => a.name).join(", ");
    const outputSummary = Object.entries(outputs)
      .filter(([key]) => key !== "final_eval")
      .map(([taskType, output]) => `[${taskType}]: ${output.slice(0, 400)}`)
      .join("\n\n");

    const systemPrompt = `You are EvaluatorAgent. You assess multi-agent swarm outputs on a 0-100 scale across 6 dimensions. Always respond with valid JSON only.`;

    const userPrompt = `Mission: ${mission}
Agents: ${agentNames}

Outputs:
${outputSummary}

Evaluate these outputs and return ONLY a JSON object with these exact keys (scores 0-100):
{"quality":N,"factuality":N,"usefulness":N,"specificity":N,"actionability":N,"collaboration":N}`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt + "\n\n" + userPrompt,
    });

    const text = response.text ?? "";
    return parseStructuredEval(text);
  } catch (err) {
    console.error("[evaluation] LLM eval failed:", err);
    return null;
  }
}

// ── Primary eval entry point ──────────────────────────────────────────────────

export async function computeEvalScore(
  mission: string,
  outputs: Record<string, string>,
  selectedAgents: Agent[],
  evalOutput: string
): Promise<EvalScore> {
  // 1. Try to parse structured eval from the evaluator agent's own output
  const fromEvalOutput = parseStructuredEval(evalOutput);
  if (fromEvalOutput) return fromEvalOutput;

  // 2. Try a fresh LLM evaluation call
  const fromLLM = await evaluateWithLLM(mission, outputs, selectedAgents);
  if (fromLLM) return fromLLM;

  // 3. Fall back to content-based local rubric
  return computeLocalRubric(outputs, selectedAgents);
}

// Re-export clamp01 for convenience (used in orchestrator)
export { clamp01 };
