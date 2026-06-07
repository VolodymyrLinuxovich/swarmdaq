import { Agent, MissionResult } from "./types";
import { DEFAULT_AGENTS } from "./agents";
import { safeRedis, isRedisEnabled } from "./redis/client";
import { KEY } from "./redis";
import { updateLeaderboards } from "./marketHistory";
import { deleteAgentState, readAgentState, writeAgentState } from "./redis/reputation";

// ── In-memory fallback ────────────────────────────────────────────────────────
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

// ── Custom agents ─────────────────────────────────────────────────────────────

export async function getCustomAgents(): Promise<Agent[]> {
  const fromRedis = await safeRedis<Agent[] | null>("getCustomAgents", async (client) => {
    const ids = await client.lRange(KEY.customAgentsList, 0, -1);
    if (!ids.length) return [];
    const agents = await Promise.all(ids.map((id) => readAgentState(id)));
    return agents.filter((a): a is Agent => a !== null);
  }, null);
  return fromRedis ?? Array.from(customAgentStore.values());
}

export async function addCustomAgent(agent: Agent): Promise<void> {
  const stored = await safeRedis("addCustomAgent", async (client) => {
    await writeAgentState(agent);
    await client.lPush(KEY.customAgentsList, agent.id);
    return true;
  }, false);
  if (!stored) customAgentStore.set(agent.id, agent);
}

export async function removeCustomAgent(agentId: string): Promise<void> {
  const removed = await safeRedis("removeCustomAgent", async (client) => {
    await deleteAgentState(agentId);
    await client.lRem(KEY.customAgentsList, 0, agentId);
    return true;
  }, false);
  if (!removed) customAgentStore.delete(agentId);
}

export async function getAgents(): Promise<Agent[]> {
  const custom = await getCustomAgents();
  if (isRedisEnabled()) {
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
  }
  initStore();
  return [...Array.from(agentStore.values()), ...custom];
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (isRedisEnabled()) {
    const fallback = DEFAULT_AGENTS.find((a) => a.id === id);
    return (await readAgentState(id, fallback)) ?? fallback ?? null;
  }
  initStore();
  return agentStore.get(id) ?? null;
}

export async function updateAgent(agentId: string, patch: Partial<Agent>): Promise<Agent> {
  if (isRedisEnabled()) {
    const existing = (await readAgentState(agentId, DEFAULT_AGENTS.find((a) => a.id === agentId))) ?? DEFAULT_AGENTS.find((a) => a.id === agentId)!;
    const updated = { ...existing, ...patch };
    await writeAgentState(updated);
    await updateLeaderboards(updated);
    return updated;
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

// ── Task memory ───────────────────────────────────────────────────────────────

export async function recordTaskMemory(taskType: string, agentId: string, score: number): Promise<void> {
  const stored = await safeRedis("recordTaskMemory", async (client) => {
    const raw = await client.get(KEY.taskMem(taskType, agentId));
    const existing = raw ? (JSON.parse(raw) as { score: number; count: number }) : { score: 0, count: 0 };
    const updated = { agentId, score: (existing.score * existing.count + score) / (existing.count + 1), count: existing.count + 1 };
    await client.set(KEY.taskMem(taskType, agentId), JSON.stringify(updated), { EX: 86400 * 7 });
    return true;
  }, false);
  if (!stored) {
    const k = `${taskType}:${agentId}`;
    const existing = taskMemory.get(k) ?? { agentId, score: 0, count: 0 };
    taskMemory.set(k, { agentId, score: (existing.score * existing.count + score) / (existing.count + 1), count: existing.count + 1 });
  }
}

export async function getTaskMemory(taskType: string, agentId: string): Promise<{ score: number; count: number } | null> {
  const fromRedis = await safeRedis<{ score: number; count: number } | null>("getTaskMemory", async (client) => {
    const raw = await client.get(KEY.taskMem(taskType, agentId));
    return raw ? JSON.parse(raw) as { score: number; count: number } : null;
  }, null);
  if (fromRedis) return fromRedis;
  const k = `${taskType}:${agentId}`;
  const e = taskMemory.get(k);
  return e ? { score: e.score, count: e.count } : null;
}

// ── Mission metadata ──────────────────────────────────────────────────────────

export async function recordMission(result: MissionResult): Promise<void> {
  const stored = await safeRedis("recordMission", async (client) => {
    const summary = { evalScore: result.evalScore, swarmPortfolio: result.swarmPortfolio, runNumber: result.runNumber };
    await client.set(KEY.lastMission, JSON.stringify(summary), { EX: 86400 });
    await client.incr(KEY.runCount);
    return true;
  }, false);
  if (!stored) {
    missionHistory.push(result);
    runCount++;
  }
}

export async function getLastMission(): Promise<MissionResult | null> {
  const fromRedis = await safeRedis<MissionResult | null>("getLastMission", async (client) => {
    const raw = await client.get(KEY.lastMission);
    return raw ? JSON.parse(raw) as MissionResult : null;
  }, null);
  return fromRedis ?? missionHistory[missionHistory.length - 1] ?? null;
}

export async function getRunCount(): Promise<number> {
  const count = await safeRedis<number | null>("getRunCount", async (client) => {
    const raw = await client.get(KEY.runCount);
    return raw !== null ? Number(raw) : null;
  }, null);
  return count ?? runCount;
}

export async function getTotalAgentRuns(): Promise<number> {
  return (await getAgents()).reduce((s, a) => s + a.runs, 0);
}

// ── Demo reset ────────────────────────────────────────────────────────────────

export async function resetDemo(): Promise<void> {
  await safeRedis("resetDemo", async (client) => {
    const customIds = await client.lRange(KEY.customAgentsList, 0, -1);
    const keys = [
      KEY.runCount, KEY.lastMission, KEY.customAgentsList,
      KEY.agentLeaderboardReputation, KEY.agentLeaderboardElo,
      KEY.agentLeaderboardFactuality, KEY.agentLeaderboardBayesian,
      KEY.agentLeaderboardUncertainty, KEY.agentLeaderboardMarketValue,
      ...DEFAULT_AGENTS.map((a) => KEY.agent(a.id)),
      ...customIds.map((id) => KEY.agent(id)),
    ];
    if (keys.length > 0) await client.del(keys);
    return true;
  }, false);

  agentStore = new Map();
  customAgentStore = new Map();
  missionHistory = [];
  taskMemory = new Map();
  runCount = 0;
  initStore();
}

export function isRedisConnected(): boolean {
  return isRedisEnabled();
}
