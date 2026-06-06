import { Agent, MissionResult } from "./types";
import { DEFAULT_AGENTS } from "./agents";
import { redis, KEY } from "./redis";
import { updateLeaderboards } from "./marketHistory";
import { deleteAgentState, readAgentState, writeAgentState } from "./redis/reputation";

// ── In-memory fallback (no Redis env) ────────────────────────────────────────
let agentStore: Map<string, Agent> = new Map();
let customAgentStore: Map<string, Agent> = new Map();
let missionHistory: MissionResult[] = [];
let taskMemory: Map<string, { agentId: string; score: number; count: number }> = new Map();
let runCount = 0;

function initStore() {
  if (agentStore.size === 0) {
    for (const a of DEFAULT_AGENTS) agentStore.set(a.id, { ...a });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getCustomAgents(): Promise<Agent[]> {
  if (redis) {
    try {
      const ids = await redis.lrange<string>(KEY.customAgentsList, 0, -1);
      if (!ids.length) return [];
      const agents = await Promise.all(ids.map((id) => readAgentState(id)));
      return agents.filter((a): a is Agent => a !== null);
    } catch (e) { console.error("[redis] getCustomAgents:", e); }
  }
  return Array.from(customAgentStore.values());
}

export async function addCustomAgent(agent: Agent): Promise<void> {
  if (redis) {
    try {
      await writeAgentState(agent);
      await redis.lpush(KEY.customAgentsList, agent.id);
      return;
    } catch (e) { console.error("[redis] addCustomAgent:", e); }
  }
  customAgentStore.set(agent.id, agent);
}

export async function removeCustomAgent(agentId: string): Promise<void> {
  if (redis) {
    try {
      await deleteAgentState(agentId);
      await redis.lrem(KEY.customAgentsList, 0, agentId);
      return;
    } catch (e) { console.error("[redis] removeCustomAgent:", e); }
  }
  customAgentStore.delete(agentId);
}

export async function getAgents(): Promise<Agent[]> {
  const custom = await getCustomAgents();
  if (redis) {
    try {
      const defaults: Agent[] = [];
      for (const def of DEFAULT_AGENTS) {
        const stored = await readAgentState(def.id, def);
        if (stored) {
          defaults.push(stored);
        } else {
          defaults.push(def);
          void writeAgentState(def).catch(() => {});
        }
      }
      return [...defaults, ...custom];
    } catch (e) { console.error("[redis] getAgents:", e); }
  }
  initStore();
  return [...Array.from(agentStore.values()), ...custom];
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (redis) {
    try {
      const fallback = DEFAULT_AGENTS.find((a) => a.id === id);
      return (await readAgentState(id, fallback)) ?? fallback ?? null;
    } catch {}
  }
  initStore();
  return agentStore.get(id) ?? null;
}

export async function updateAgent(agentId: string, patch: Partial<Agent>): Promise<Agent> {
  if (redis) {
    try {
      const existing = (await readAgentState(agentId, DEFAULT_AGENTS.find((a) => a.id === agentId))) ?? DEFAULT_AGENTS.find((a) => a.id === agentId)!;
      const updated = { ...existing, ...patch };
      await writeAgentState(updated);
      // Keep all leaderboard dimensions in sync whenever an agent is updated
      await updateLeaderboards(updated);
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
      const existing = (await redis.get<{ score: number; count: number }>(KEY.taskMem(taskType, agentId))) ?? { score: 0, count: 0 };
      const updated = { agentId, score: (existing.score * existing.count + score) / (existing.count + 1), count: existing.count + 1 };
      await redis.set(KEY.taskMem(taskType, agentId), updated, { ex: 86400 * 7 });
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
      const d = await redis.get<{ score: number; count: number }>(KEY.taskMem(taskType, agentId));
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
      await redis.set(KEY.lastMission, summary, { ex: 86400 });
      await redis.incr(KEY.runCount);
      return;
    } catch (e) { console.error("[redis] recordMission:", e); }
  }
  missionHistory.push(result);
  runCount++;
}

export async function getLastMission(): Promise<MissionResult | null> {
  if (redis) {
    try { return await redis.get<MissionResult>(KEY.lastMission); } catch {}
  }
  return missionHistory[missionHistory.length - 1] ?? null;
}

export async function getRunCount(): Promise<number> {
  if (redis) {
    try {
      const v = await redis.get<number>(KEY.runCount);
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
      const customIds = await redis.lrange<string>(KEY.customAgentsList, 0, -1);
      const keys = [
        KEY.runCount,
        KEY.lastMission,
        KEY.customAgentsList,
        KEY.agentLeaderboardReputation,
        KEY.agentLeaderboardElo,
        KEY.agentLeaderboardFactuality,
        KEY.agentLeaderboardBayesian,
        KEY.agentLeaderboardUncertainty,
        KEY.agentLeaderboardMarketValue,
        ...DEFAULT_AGENTS.map((a) => KEY.agent(a.id)),
        ...customIds.map((id) => KEY.agent(id)),
      ];
      if (keys.length > 0) await redis.del(...keys);
    } catch (e) { console.error("[redis] resetDemo:", e); }
  }
  agentStore = new Map();
  customAgentStore = new Map();
  missionHistory = [];
  taskMemory = new Map();
  runCount = 0;
  initStore();
}

export function isRedisConnected(): boolean {
  return redis !== null;
}
