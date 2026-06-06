import { Redis } from "@upstash/redis";
import { Agent, MissionResult } from "./types";
import { DEFAULT_AGENTS } from "./agents";

// ── Upstash Redis (HTTP, works in Vercel serverless) ─────────────────────────
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// ── In-memory fallback (no Redis env) ────────────────────────────────────────
let agentStore: Map<string, Agent> = new Map();
let missionHistory: MissionResult[] = [];
let taskMemory: Map<string, { agentId: string; score: number; count: number }> = new Map();
let runCount = 0;

function initStore() {
  if (agentStore.size === 0) {
    for (const a of DEFAULT_AGENTS) agentStore.set(a.id, { ...a });
  }
}

// ── Key schema ────────────────────────────────────────────────────────────────
const KEY_RUN_COUNT    = "swarmdaq:runCount";
const KEY_LAST_MISSION = "swarmdaq:lastMission";
const agentKey  = (id: string) => `swarmdaq:agent:${id}`;
const taskKey   = (type: string, id: string) => `swarmdaq:mem:${type}:${id}`;

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<Agent[]> {
  if (redis) {
    try {
      const agents: Agent[] = [];
      for (const def of DEFAULT_AGENTS) {
        const stored = await redis.get<Agent>(agentKey(def.id));
        agents.push(stored ?? def);
      }
      return agents;
    } catch (e) { console.error("[redis] getAgents:", e); }
  }
  initStore();
  return Array.from(agentStore.values());
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (redis) {
    try { return await redis.get<Agent>(agentKey(id)); } catch {}
  }
  initStore();
  return agentStore.get(id) ?? null;
}

export async function updateAgent(agentId: string, patch: Partial<Agent>): Promise<Agent> {
  if (redis) {
    try {
      const existing = (await redis.get<Agent>(agentKey(agentId))) ?? DEFAULT_AGENTS.find((a) => a.id === agentId)!;
      const updated = { ...existing, ...patch };
      await redis.set(agentKey(agentId), updated);
      await redis.zadd("swarmdaq:leaderboard", { score: updated.reputation, member: agentId });
      return updated;
    } catch (e) { console.error("[redis] updateAgent:", e); }
  }
  initStore();
  const existing = agentStore.get(agentId);
  if (!existing) throw new Error(`Agent ${agentId} not found`);
  const updated = { ...existing, ...patch };
  agentStore.set(agentId, updated);
  return updated;
}

export async function getLeaderboard(): Promise<Agent[]> {
  return (await getAgents()).sort((a, b) => b.reputation - a.reputation);
}

export async function recordTaskMemory(taskType: string, agentId: string, score: number): Promise<void> {
  if (redis) {
    try {
      const existing = (await redis.get<{ score: number; count: number }>(taskKey(taskType, agentId))) ?? { score: 0, count: 0 };
      const updated = { agentId, score: (existing.score * existing.count + score) / (existing.count + 1), count: existing.count + 1 };
      await redis.set(taskKey(taskType, agentId), updated, { ex: 86400 * 7 });
      return;
    } catch (e) { console.error("[redis] recordTaskMemory:", e); }
  }
  const k = `${taskType}:${agentId}`;
  const existing = taskMemory.get(k) ?? { agentId, score: 0, count: 0 };
  taskMemory.set(k, { agentId, score: (existing.score * existing.count + score) / (existing.count + 1), count: existing.count + 1 });
}

export async function getTaskMemory(taskType: string, agentId: string): Promise<{ score: number; count: number } | null> {
  if (redis) {
    try {
      const d = await redis.get<{ score: number; count: number }>(taskKey(taskType, agentId));
      return d ?? null;
    } catch {}
  }
  const k = `${taskType}:${agentId}`;
  const e = taskMemory.get(k);
  return e ? { score: e.score, count: e.count } : null;
}

export async function recordMission(result: MissionResult): Promise<void> {
  if (redis) {
    try {
      const summary = { evalScore: result.evalScore, swarmPortfolio: result.swarmPortfolio, runNumber: result.runNumber };
      await redis.set(KEY_LAST_MISSION, summary, { ex: 86400 });
      await redis.incr(KEY_RUN_COUNT);
      return;
    } catch (e) { console.error("[redis] recordMission:", e); }
  }
  missionHistory.push(result);
  runCount++;
}

export async function getLastMission(): Promise<MissionResult | null> {
  if (redis) {
    try { return await redis.get<MissionResult>(KEY_LAST_MISSION); } catch {}
  }
  return missionHistory[missionHistory.length - 1] ?? null;
}

export async function getRunCount(): Promise<number> {
  if (redis) {
    try {
      const v = await redis.get<number>(KEY_RUN_COUNT);
      return v ?? 0;
    } catch {}
  }
  return runCount;
}

export async function getTotalAgentRuns(): Promise<number> {
  return (await getAgents()).reduce((s, a) => s + a.runs, 0);
}

export async function resetDemo(): Promise<void> {
  if (redis) {
    try {
      const keys = [
        KEY_RUN_COUNT,
        KEY_LAST_MISSION,
        "swarmdaq:leaderboard",
        ...DEFAULT_AGENTS.map((a) => agentKey(a.id)),
      ];
      if (keys.length > 0) await redis.del(...keys);
    } catch (e) { console.error("[redis] resetDemo:", e); }
  }
  agentStore = new Map();
  missionHistory = [];
  taskMemory = new Map();
  runCount = 0;
  initStore();
}

export function isRedisConnected(): boolean {
  return redis !== null;
}
