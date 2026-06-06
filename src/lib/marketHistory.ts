/**
 * Redis market memory layer.
 *
 * Redis structures used:
 *   swarmdaq:missions:index         SORTED SET  — missions scored by createdAt timestamp
 *   swarmdaq:mission:{id}           STRING      — full MissionResult JSON (TTL 7d)
 *   swarmdaq:events:{id}            LIST        — append-only mission event log
 *   swarmdaq:market:feed            LIST        — rolling window of market events (100 max)
 *   swarmdaq:agent:{id}:history     LIST        — per-agent score history (20 entries)
 *   swarmdaq:lb:reputation          SORTED SET  — leaderboard by reputation
 *   swarmdaq:lb:bayesian            SORTED SET  — leaderboard by Bayesian mean
 *   swarmdaq:lb:elo                 SORTED SET  — leaderboard by Elo
 *   swarmdaq:lb:uncertainty         SORTED SET  — leaderboard by (1 - uncertainty) so low = bottom
 */

import { redis, KEY } from "./redis";
import type { MissionResult, Agent } from "./types";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface MissionEvent {
  eventType: string;
  missionId: string;
  runNumber: number;
  timestamp: number;
  agentId?: string;
  agentName?: string;
  score?: number;
  delta?: number;
  message: string;
  payload?: Record<string, unknown>;
}

export interface MarketFeedEvent {
  timestamp: number;
  agentId?: string;
  agentName?: string;
  eventType: "reputation_update" | "mission_complete" | "agent_promoted" | "agent_penalized" | "market_reset" | "mission_started";
  text: string;
  delta?: number;
  color: string;
  label?: string;
}

export interface MissionSummary {
  missionId: string;
  mission: string;
  runNumber: number;
  createdAt: number;
  overallScore: number;
  selectedAgents: string[];
  reputationChanges: Array<{ agentId: string; agentName: string; delta: number }>;
}

export interface AgentHistoryEntry {
  missionId: string;
  runNumber: number;
  score: number;
  delta: number;
  timestamp: number;
  role: string;
}

export interface MarketMemorySummary {
  mode: "redis" | "in-memory";
  totalMissions: number;
  lastMissionId: string | null;
  topAgent: { id: string; name: string; reputation: number } | null;
  riskiestAgent: { id: string; name: string; uncertainty: number } | null;
  recentEvents: MarketFeedEvent[];
  leaderboard: Array<{ id: string; name: string; score: number; label: string }>;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

const inMemMissions: Map<string, MissionResult> = new Map();
const inMemMissionOrder: string[] = [];   // insertion order
const inMemEvents: Map<string, MissionEvent[]> = new Map();
const inMemFeed: MarketFeedEvent[] = [];
const inMemAgentHistory: Map<string, AgentHistoryEntry[]> = new Map();

// ── Mission events (Redis List per mission) ───────────────────────────────────

export async function appendMissionEvent(event: MissionEvent): Promise<void> {
  const str = JSON.stringify(event);
  if (redis) {
    try {
      await redis.lpush(KEY.missionEvents(event.missionId), str);
      await redis.expire(KEY.missionEvents(event.missionId), 86400 * 7);
      return;
    } catch (e) { console.error("[redis] appendMissionEvent:", e); }
  }
  const list = inMemEvents.get(event.missionId) ?? [];
  list.unshift(event);
  inMemEvents.set(event.missionId, list);
}

export async function getMissionEvents(missionId: string): Promise<MissionEvent[]> {
  if (redis) {
    try {
      const raw = await redis.lrange(KEY.missionEvents(missionId), 0, -1);
      const events = raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as MissionEvent);
      return events.reverse(); // chronological order
    } catch (e) { console.error("[redis] getMissionEvents:", e); }
  }
  return [...(inMemEvents.get(missionId) ?? [])].reverse();
}

// ── Market feed (Redis List, capped at 100) ───────────────────────────────────

export async function appendMarketFeed(event: MarketFeedEvent): Promise<void> {
  const str = JSON.stringify(event);
  if (redis) {
    try {
      await redis.lpush(KEY.marketFeed, str);
      await redis.ltrim(KEY.marketFeed, 0, 99);
      return;
    } catch (e) { console.error("[redis] appendMarketFeed:", e); }
  }
  inMemFeed.unshift(event);
  if (inMemFeed.length > 100) inMemFeed.pop();
}

export async function getMarketFeed(limit = 20): Promise<MarketFeedEvent[]> {
  if (redis) {
    try {
      const raw = await redis.lrange(KEY.marketFeed, 0, limit - 1);
      return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as MarketFeedEvent);
    } catch (e) { console.error("[redis] getMarketFeed:", e); }
  }
  return inMemFeed.slice(0, limit);
}

// ── Full mission storage (sorted set index + JSON value) ─────────────────────

export async function storeMission(result: MissionResult): Promise<void> {
  const now = Date.now();
  const json = JSON.stringify(result);

  if (redis) {
    try {
      await Promise.all([
        redis.set(KEY.mission(result.missionId), json, { ex: 86400 * 7 }),
        redis.zadd(KEY.missionsIndex, { score: now, member: result.missionId }),
        // keep index to 50 entries
        redis.zremrangebyrank(KEY.missionsIndex, 0, -51),
      ]);
      return;
    } catch (e) { console.error("[redis] storeMission:", e); }
  }
  inMemMissions.set(result.missionId, result);
  inMemMissionOrder.unshift(result.missionId);
  if (inMemMissionOrder.length > 50) {
    const old = inMemMissionOrder.pop()!;
    inMemMissions.delete(old);
  }
}

export async function getMissionById(missionId: string): Promise<MissionResult | null> {
  if (redis) {
    try {
      const raw = await redis.get(KEY.mission(missionId));
      if (!raw) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw as MissionResult;
    } catch (e) { console.error("[redis] getMissionById:", e); }
  }
  return inMemMissions.get(missionId) ?? null;
}

export async function getRecentMissions(limit = 10): Promise<MissionSummary[]> {
  if (redis) {
    try {
      // zrange with rev:true returns most-recent first
      const ids = await redis.zrange(KEY.missionsIndex, 0, limit - 1, { rev: true }) as string[];
      const summaries: MissionSummary[] = [];
      for (const id of ids) {
        const raw = await redis.get(KEY.mission(id));
        if (!raw) continue;
        const r = (typeof raw === "string" ? JSON.parse(raw) : raw) as MissionResult;
        summaries.push({
          missionId: r.missionId,
          mission: r.mission.slice(0, 120),
          runNumber: r.runNumber,
          createdAt: Date.now(), // stored timestamp not in result, approximate
          overallScore: r.evalScore.overall,
          selectedAgents: r.selectedAgents.map((a) => a.name),
          reputationChanges: r.reputationChanges.map((c) => ({ agentId: c.agentId, agentName: c.agentName, delta: c.delta })),
        });
      }
      return summaries;
    } catch (e) { console.error("[redis] getRecentMissions:", e); }
  }
  return inMemMissionOrder.slice(0, limit).map((id) => {
    const r = inMemMissions.get(id)!;
    return {
      missionId: r.missionId,
      mission: r.mission.slice(0, 120),
      runNumber: r.runNumber,
      createdAt: Date.now(),
      overallScore: r.evalScore.overall,
      selectedAgents: r.selectedAgents.map((a) => a.name),
      reputationChanges: r.reputationChanges.map((c) => ({ agentId: c.agentId, agentName: c.agentName, delta: c.delta })),
    };
  });
}

export async function getTotalMissionCount(): Promise<number> {
  if (redis) {
    try {
      return await redis.zcard(KEY.missionsIndex);
    } catch {}
  }
  return inMemMissions.size;
}

// ── Per-agent history (Redis List) ────────────────────────────────────────────

export async function appendAgentHistory(agentId: string, entry: AgentHistoryEntry): Promise<void> {
  const str = JSON.stringify(entry);
  if (redis) {
    try {
      await redis.lpush(KEY.agentHistory(agentId), str);
      await redis.ltrim(KEY.agentHistory(agentId), 0, 19); // keep last 20
      return;
    } catch (e) { console.error("[redis] appendAgentHistory:", e); }
  }
  const list = inMemAgentHistory.get(agentId) ?? [];
  list.unshift(entry);
  if (list.length > 20) list.pop();
  inMemAgentHistory.set(agentId, list);
}

export async function getAgentHistory(agentId: string, limit = 10): Promise<AgentHistoryEntry[]> {
  if (redis) {
    try {
      const raw = await redis.lrange(KEY.agentHistory(agentId), 0, limit - 1);
      return raw.map((r) => (typeof r === "string" ? JSON.parse(r) : r) as AgentHistoryEntry);
    } catch (e) { console.error("[redis] getAgentHistory:", e); }
  }
  return (inMemAgentHistory.get(agentId) ?? []).slice(0, limit);
}

// ── Leaderboard management ─────────────────────────────────────────────────────

export async function updateLeaderboards(agent: Agent): Promise<void> {
  if (!redis) return;
  try {
    await Promise.all([
      redis.zadd(KEY.lbReputation,   { score: agent.reputation,             member: agent.id }),
      redis.zadd(KEY.lbBayesian,     { score: agent.bayesianMean * 1000,    member: agent.id }),
      redis.zadd(KEY.lbElo,          { score: agent.elo,                    member: agent.id }),
      redis.zadd(KEY.lbUncertainty,  { score: (1 - agent.uncertainty) * 100, member: agent.id }), // invert: high score = low uncertainty
    ]);
  } catch (e) { console.error("[redis] updateLeaderboards:", e); }
}

// ── Market memory summary ─────────────────────────────────────────────────────

export async function getMarketMemorySummary(agents: Agent[]): Promise<MarketMemorySummary> {
  const mode = isRedisAvailable() ? "redis" : "in-memory";
  const totalMissions = await getTotalMissionCount();
  const recentMissions = await getRecentMissions(1);
  const lastMissionId = recentMissions[0]?.missionId ?? null;
  const recentEvents = await getMarketFeed(8);

  const sorted = [...agents].sort((a, b) => b.reputation - a.reputation);
  const topAgent = sorted[0] ? { id: sorted[0].id, name: sorted[0].name, reputation: sorted[0].reputation } : null;
  const riskiest = [...agents].sort((a, b) => b.uncertainty - a.uncertainty)[0];
  const riskiestAgent = riskiest ? { id: riskiest.id, name: riskiest.name, uncertainty: riskiest.uncertainty } : null;

  const labelColors: Record<string, string> = { BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff" };

  const leaderboard = sorted.map((a) => {
    let label = "HOLD";
    if (a.uncertainty > 0.12) label = "WATCH";
    else if (a.bayesianMean > 0.84 && a.reputation > 88 && a.uncertainty < 0.09) label = "BUY";
    else if (a.bayesianMean < 0.65 || a.reputation < 75) label = "SELL";
    return { id: a.id, name: a.name, score: a.reputation, label, color: labelColors[label] };
  });

  return { mode, totalMissions, lastMissionId, topAgent, riskiestAgent, recentEvents, leaderboard };
}

function isRedisAvailable(): boolean {
  return redis !== null;
}

// ── Run comparison ─────────────────────────────────────────────────────────────

export async function getRunComparison(runA: number, runB: number): Promise<{
  runA: MissionResult | null;
  runB: MissionResult | null;
  delta: {
    overall: number; quality: number; factuality: number; usefulness: number;
    actionability: number; cost: number; swarmObjective: number;
  } | null;
  explanation: string;
} | null> {
  const missions = await getRecentMissions(50);
  const sA = missions.find((m) => m.runNumber === runA);
  const sB = missions.find((m) => m.runNumber === runB);
  if (!sA || !sB) return null;

  const mA = await getMissionById(sA.missionId);
  const mB = await getMissionById(sB.missionId);
  if (!mA || !mB) return null;

  const delta = {
    overall:       mB.evalScore.overall       - mA.evalScore.overall,
    quality:       mB.evalScore.quality       - mA.evalScore.quality,
    factuality:    mB.evalScore.factuality     - mA.evalScore.factuality,
    usefulness:    mB.evalScore.usefulness     - mA.evalScore.usefulness,
    actionability: mB.evalScore.actionability  - mA.evalScore.actionability,
    cost:          (mB.runCost?.totalUSD ?? 0) - (mA.runCost?.totalUSD ?? 0),
    swarmObjective: mB.swarmPortfolio.objective - mA.swarmPortfolio.objective,
  };

  const swarmChanged = mB.selectedAgents.map((a) => a.id).sort().join(",") !== mA.selectedAgents.map((a) => a.id).sort().join(",");
  const dominantGain = Object.entries(delta).filter(([k]) => k !== "cost" && k !== "swarmObjective").sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))[0];
  const explanation = [
    `Run ${runA} scored ${mA.evalScore.overall}, run ${runB} scored ${mB.evalScore.overall} (${delta.overall > 0 ? "+" : ""}${delta.overall} pts).`,
    dominantGain ? `Biggest shift: ${dominantGain[0]} ${delta[dominantGain[0] as keyof typeof delta] > 0 ? "+" : ""}${delta[dominantGain[0] as keyof typeof delta]}.` : "",
    swarmChanged ? `Swarm composition changed: run ${runA} used ${mA.selectedAgents.map((a) => a.name).join(", ")}; run ${runB} used ${mB.selectedAgents.map((a) => a.name).join(", ")}.` : "Same swarm composition.",
    mB.improvementFromPrevious?.message ?? "",
  ].filter(Boolean).join(" ");

  return { runA: mA, runB: mB, delta, explanation };
}

// ── Redis clear (add mission artifacts to reset) ──────────────────────────────

export async function clearMarketHistory(): Promise<void> {
  if (!redis) {
    inMemMissions.clear();
    inMemMissionOrder.length = 0;
    inMemEvents.clear();
    inMemFeed.length = 0;
    inMemAgentHistory.clear();
    return;
  }
  try {
    const missionIds = await redis.zrange(KEY.missionsIndex, 0, -1) as string[];
    const keysToDelete = [
      KEY.missionsIndex,
      KEY.marketFeed,
      KEY.lbReputation,
      KEY.lbBayesian,
      KEY.lbElo,
      KEY.lbUncertainty,
      ...missionIds.map((id) => KEY.mission(id)),
      ...missionIds.map((id) => KEY.missionEvents(id)),
    ];
    if (keysToDelete.length > 0) await redis.del(...keysToDelete);
  } catch (e) { console.error("[redis] clearMarketHistory:", e); }
}
