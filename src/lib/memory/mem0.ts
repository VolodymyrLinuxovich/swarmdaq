const MEM0_API_KEY = process.env.MEM0_API_KEY;
const MEM0_BASE_URL = "https://api.mem0.ai/v1";

const devWarnings = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (process.env.NODE_ENV === "production" || devWarnings.has(key)) return;
  devWarnings.add(key);
  console.warn(msg);
}

if (!MEM0_API_KEY) {
  warnOnce("mem0-disabled", "Mem0 disabled: missing MEM0_API_KEY; agent memory will not persist.");
}

export function isMem0Enabled(): boolean {
  return Boolean(MEM0_API_KEY);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Mem0MemoryMeta {
  missionId?: string;
  taskType?: string;
  mode?: string;
  score?: number;
  factuality?: number;
  priceAnomalyLabel?: string;
  [key: string]: unknown;
}

export interface Mem0Memory {
  id: string;
  memory: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function mem0Fetch<T>(path: string, init: RequestInit): Promise<T | null> {
  if (!MEM0_API_KEY) return null;
  try {
    const res = await fetch(`${MEM0_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${MEM0_API_KEY}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      warnOnce(`mem0-${path}`, `[mem0] ${path} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    warnOnce(`mem0-fetch-${path}`, `[mem0] fetch failed: ${(err as Error).message}`);
    return null;
  }
}

// ── Core save / search ────────────────────────────────────────────────────────

export async function saveAgentMemory(params: {
  agentId: string;
  runId: string;
  content: string;
  metadata?: Mem0MemoryMeta;
}): Promise<boolean> {
  if (!MEM0_API_KEY) return false;
  const result = await mem0Fetch<unknown>("/memories/", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: params.content }],
      user_id: "swarmdaq",
      agent_id: params.agentId,
      run_id: params.runId,
      metadata: params.metadata ?? {},
    }),
  });
  return result !== null;
}

export async function searchAgentMemory(params: {
  agentId: string;
  runId?: string;
  query: string;
  limit?: number;
}): Promise<Mem0Memory[]> {
  if (!MEM0_API_KEY) return [];
  const result = await mem0Fetch<{ results?: Mem0Memory[] }>("/memories/search/", {
    method: "POST",
    body: JSON.stringify({
      query: params.query,
      user_id: "swarmdaq",
      agent_id: params.agentId,
      run_id: params.runId,
      limit: params.limit ?? 10,
    }),
  });
  return result?.results ?? [];
}

export async function getAgentContext(agentId: string, topic: string): Promise<string> {
  const memories = await searchAgentMemory({ agentId, query: topic, limit: 5 });
  if (memories.length === 0) return "";
  return memories.map((m) => m.memory).join("\n");
}

// ── Domain-specific saves ─────────────────────────────────────────────────────

export async function saveRunSummaryToMemory(p: {
  agentId: string;
  runId: string;
  missionId: string;
  taskType: string;
  score: number;
  outcome: "success" | "failure";
  reason?: string;
}): Promise<boolean> {
  const verb = p.outcome === "success" ? "performed well" : "failed";
  return saveAgentMemory({
    agentId: p.agentId,
    runId: p.runId,
    content: `Agent ${verb} on ${p.taskType} task (score ${p.score})${p.reason ? ": " + p.reason : ""}.`,
    metadata: { missionId: p.missionId, taskType: p.taskType, score: p.score, mode: p.outcome },
  });
}

export async function saveAnomalyExplanationToMemory(p: {
  agentId: string;
  runId: string;
  missionId: string;
  taskType: string;
  priceAnomalyLabel: string;
  price: number;
  clearingPrice?: number;
  explanation?: string;
}): Promise<boolean> {
  const detail = p.clearingPrice !== undefined ? `, clearing ${p.clearingPrice}` : "";
  return saveAgentMemory({
    agentId: p.agentId,
    runId: p.runId,
    content: `Price anomaly (${p.priceAnomalyLabel}) on ${p.taskType}: bid ${p.price}${detail}${p.explanation ? ". " + p.explanation : ""}.`,
    metadata: { missionId: p.missionId, taskType: p.taskType, priceAnomalyLabel: p.priceAnomalyLabel, mode: "price_anomaly" },
  });
}

export async function saveAgentStrength(p: { agentId: string; runId: string; taskType: string; score: number; missionId: string }) {
  return saveAgentMemory({
    agentId: p.agentId, runId: p.runId,
    content: `Agent performed well on ${p.taskType} task (score ${p.score}).`,
    metadata: { missionId: p.missionId, taskType: p.taskType, score: p.score, mode: "strength" },
  });
}

export async function saveAgentFailure(p: { agentId: string; runId: string; taskType: string; score: number; missionId: string; reason?: string }) {
  return saveAgentMemory({
    agentId: p.agentId, runId: p.runId,
    content: `Agent failed on ${p.taskType} task (score ${p.score})${p.reason ? ": " + p.reason : ""}.`,
    metadata: { missionId: p.missionId, taskType: p.taskType, score: p.score, mode: "failure" },
  });
}

export async function saveFactualityMistake(p: { agentId: string; runId: string; taskType: string; factuality: number; missionId: string; explanation?: string }) {
  return saveAgentMemory({
    agentId: p.agentId, runId: p.runId,
    content: `Factuality issue on ${p.taskType} (factuality ${p.factuality})${p.explanation ? ": " + p.explanation : ""}.`,
    metadata: { missionId: p.missionId, taskType: p.taskType, factuality: p.factuality, mode: "factuality_mistake" },
  });
}

export async function savePriceAnomaly(p: { agentId: string; runId: string; taskType: string; missionId: string; priceAnomalyLabel: string; price: number; clearingPrice?: number }) {
  return saveAnomalyExplanationToMemory(p);
}

export async function saveHighPriceJustified(p: { agentId: string; runId: string; taskType: string; missionId: string; score: number; explanation?: string }) {
  return saveAgentMemory({
    agentId: p.agentId, runId: p.runId,
    content: `High price was justified for ${p.taskType} (score ${p.score})${p.explanation ? ": " + p.explanation : ""}.`,
    metadata: { missionId: p.missionId, taskType: p.taskType, score: p.score, mode: "high_price_justified" },
  });
}

export async function saveEvaluatorExplanation(p: { agentId: string; runId: string; missionId: string; taskType: string; explanation: string; score: number }) {
  return saveAgentMemory({
    agentId: p.agentId, runId: p.runId,
    content: `Evaluator on ${p.taskType}: "${p.explanation}" (score ${p.score}).`,
    metadata: { missionId: p.missionId, taskType: p.taskType, score: p.score, mode: "evaluator_explanation" },
  });
}

export async function saveJudgeSummary(p: { agentId: string; runId: string; missionId: string; summary: string }) {
  return saveAgentMemory({
    agentId: p.agentId, runId: p.runId,
    content: `Judge summary: "${p.summary}".`,
    metadata: { missionId: p.missionId, mode: "judge_summary" },
  });
}

// Legacy compat aliases
export const saveMemory = saveAgentMemory;
export const searchMemory = searchAgentMemory;
