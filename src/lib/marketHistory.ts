/**
 * Redis market memory layer.
 *
 * Redis structures:
 *   swarmdaq:missions:index         SORTED SET  — missions scored by createdAt timestamp
 *   swarmdaq:mission:{id}           STRING      — full MissionResult JSON (TTL 7d)
 *   swarmdaq:events:{id}            LIST        — append-only mission event log
 *   swarmdaq:market:feed            LIST        — rolling window of market events (100 max)
 *   swarmdaq:agent:{id}:history     LIST        — per-agent score history (20 entries)
 *   swarmdaq:agent:leaderboard:*    SORTED SET  — reputation, Elo, factuality, market value
 *   swarmdaq:stream:market-events   STREAM      — append-only market event ledger
 *   swarmdaq:tdigest:*              TDIGEST/LIST — percentile market intelligence
 */

import { safeRedis, isRedisEnabled } from "./redis/client";
import { KEY } from "./redis";
import type { MissionResult, Agent } from "./types";
import { addTDigestValue } from "./tdigest";
import { updateAgentLeaderboards } from "./redis/reputation";
import { clearInMemoryStreams } from "./redis/streams";
import { clearInMemoryAnomalies } from "./market/price-anomaly";
import { resetLocalTDigestFallback } from "./tdigest";

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
const inMemMissionOrder: string[] = [];
const inMemEvents: Map<string, MissionEvent[]> = new Map();
const inMemFeed: MarketFeedEvent[] = [];
const inMemAgentHistory: Map<string, AgentHistoryEntry[]> = new Map();

// ── Mission events ────────────────────────────────────────────────────────────

export async function appendMissionEvent(event: MissionEvent): Promise<void> {
  const str = JSON.stringify(event);
  const stored = await safeRedis("appendMissionEvent", async (client) => {
    await client.lPush(KEY.missionEvents(event.missionId), str);
    await client.expire(KEY.missionEvents(event.missionId), 86400 * 7);
    return true;
  }, false);
  if (stored) return;
  const list = inMemEvents.get(event.missionId) ?? [];
  list.unshift(event);
  inMemEvents.set(event.missionId, list);
}

export async function getMissionEvents(missionId: string): Promise<MissionEvent[]> {
  const fromRedis = await safeRedis<MissionEvent[] | null>("getMissionEvents", async (client) => {
    const raw = await client.lRange(KEY.missionEvents(missionId), 0, -1);
    return raw.map((r) => JSON.parse(r) as MissionEvent).reverse();
  }, null);
  return fromRedis ?? [...(inMemEvents.get(missionId) ?? [])].reverse();
}

// ── Market feed ───────────────────────────────────────────────────────────────

export async function appendMarketFeed(event: MarketFeedEvent): Promise<void> {
  const str = JSON.stringify(event);
  const stored = await safeRedis("appendMarketFeed", async (client) => {
    await client.lPush(KEY.marketFeed, str);
    await client.lTrim(KEY.marketFeed, 0, 99);
    return true;
  }, false);
  if (stored) return;
  inMemFeed.unshift(event);
  if (inMemFeed.length > 100) inMemFeed.pop();
}

export async function getMarketFeed(limit = 20): Promise<MarketFeedEvent[]> {
  const fromRedis = await safeRedis<MarketFeedEvent[] | null>("getMarketFeed", async (client) => {
    const raw = await client.lRange(KEY.marketFeed, 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as MarketFeedEvent);
  }, null);
  return fromRedis ?? inMemFeed.slice(0, limit);
}

// ── Full mission storage ──────────────────────────────────────────────────────

export async function storeMission(result: MissionResult): Promise<void> {
  const now = Date.now();
  const json = JSON.stringify(result);

  const stored = await safeRedis("storeMission", async (client) => {
    await Promise.all([
      client.set(KEY.mission(result.missionId), json, { EX: 86400 * 7 }),
      client.zAdd(KEY.missionsIndex, { score: now, value: result.missionId }),
      client.zRemRangeByRank(KEY.missionsIndex, 0, -51),
    ]);

    // Fire-and-forget t-digest analytics
    const s = result.evalScore;
    void Promise.all([
      addTDigestValue(KEY.tdScoreOverall, s.overall),
      addTDigestValue(KEY.tdScoreDimension("quality"), s.quality),
      addTDigestValue(KEY.tdScoreDimension("factuality"), s.factuality),
      addTDigestValue(KEY.tdScoreDimension("usefulness"), s.usefulness),
      addTDigestValue(KEY.tdScoreDimension("specificity"), s.specificity),
      addTDigestValue(KEY.tdScoreDimension("actionability"), s.actionability),
      addTDigestValue(KEY.tdScoreDimension("collaboration"), s.collaboration),
    ]).catch(() => {});

    return true;
  }, false);

  if (stored) return;
  inMemMissions.set(result.missionId, result);
  inMemMissionOrder.unshift(result.missionId);
  if (inMemMissionOrder.length > 50) {
    const old = inMemMissionOrder.pop()!;
    inMemMissions.delete(old);
  }
}

export async function getMissionById(missionId: string): Promise<MissionResult | null> {
  const fromRedis = await safeRedis<MissionResult | null>("getMissionById", async (client) => {
    const raw = await client.get(KEY.mission(missionId));
    if (!raw) return null;
    return JSON.parse(raw) as MissionResult;
  }, null);
  return fromRedis ?? inMemMissions.get(missionId) ?? null;
}

export async function getRecentMissions(limit = 10): Promise<MissionSummary[]> {
  const fromRedis = await safeRedis<MissionSummary[] | null>("getRecentMissions", async (client) => {
    const ids = await client.zRange(KEY.missionsIndex, 0, limit - 1, { REV: true });
    const summaries: MissionSummary[] = [];
    for (const id of ids) {
      const raw = await client.get(KEY.mission(id));
      if (!raw) continue;
      const r = JSON.parse(raw) as MissionResult;
      summaries.push({
        missionId: r.missionId,
        mission: r.mission.slice(0, 120),
        runNumber: r.runNumber,
        createdAt: Date.now(),
        overallScore: r.evalScore.overall,
        selectedAgents: r.selectedAgents.map((a) => a.name),
        reputationChanges: r.reputationChanges.map((c) => ({ agentId: c.agentId, agentName: c.agentName, delta: c.delta })),
      });
    }
    return summaries;
  }, null);
  if (fromRedis) return fromRedis;
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
  const count = await safeRedis("getTotalMissionCount", (client) => client.zCard(KEY.missionsIndex), null);
  return count ?? inMemMissions.size;
}

// ── Per-agent history ─────────────────────────────────────────────────────────

export async function appendAgentHistory(agentId: string, entry: AgentHistoryEntry): Promise<void> {
  const str = JSON.stringify(entry);
  const stored = await safeRedis("appendAgentHistory", async (client) => {
    await client.lPush(KEY.agentHistory(agentId), str);
    await client.lTrim(KEY.agentHistory(agentId), 0, 19);
    void Promise.all([
      addTDigestValue(KEY.tdAgentScore(agentId), entry.score),
      addTDigestValue(KEY.tdAgentDelta(agentId), entry.delta),
    ]).catch(() => {});
    return true;
  }, false);
  if (stored) return;
  const list = inMemAgentHistory.get(agentId) ?? [];
  list.unshift(entry);
  if (list.length > 20) list.pop();
  inMemAgentHistory.set(agentId, list);
}

export async function getAgentHistory(agentId: string, limit = 10): Promise<AgentHistoryEntry[]> {
  const fromRedis = await safeRedis<AgentHistoryEntry[] | null>("getAgentHistory", async (client) => {
    const raw = await client.lRange(KEY.agentHistory(agentId), 0, limit - 1);
    return raw.map((r) => JSON.parse(r) as AgentHistoryEntry);
  }, null);
  return fromRedis ?? (inMemAgentHistory.get(agentId) ?? []).slice(0, limit);
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function updateLeaderboards(agent: Agent): Promise<void> {
  await updateAgentLeaderboards(agent);
}

// ── Market memory summary ─────────────────────────────────────────────────────

export async function getMarketMemorySummary(agents: Agent[]): Promise<MarketMemorySummary> {
  const mode = isRedisEnabled() ? "redis" : "in-memory";
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

// ── Run comparison ────────────────────────────────────────────────────────────

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
    overall:        mB.evalScore.overall       - mA.evalScore.overall,
    quality:        mB.evalScore.quality       - mA.evalScore.quality,
    factuality:     mB.evalScore.factuality    - mA.evalScore.factuality,
    usefulness:     mB.evalScore.usefulness    - mA.evalScore.usefulness,
    actionability:  mB.evalScore.actionability - mA.evalScore.actionability,
    cost:           (mB.runCost?.totalUSD ?? 0) - (mA.runCost?.totalUSD ?? 0),
    swarmObjective: mB.swarmPortfolio.objective - mA.swarmPortfolio.objective,
  };

  const swarmChanged = mB.selectedAgents.map((a) => a.id).sort().join(",") !== mA.selectedAgents.map((a) => a.id).sort().join(",");
  const dominantGain = Object.entries(delta)
    .filter(([k]) => k !== "cost" && k !== "swarmObjective")
    .sort(([, a], [, b]) => Math.abs(b as number) - Math.abs(a as number))[0];

  const explanation = [
    `Run ${runA} scored ${mA.evalScore.overall}, run ${runB} scored ${mB.evalScore.overall} (${delta.overall > 0 ? "+" : ""}${delta.overall} pts).`,
    dominantGain ? `Biggest shift: ${dominantGain[0]} ${(delta[dominantGain[0] as keyof typeof delta] as number) > 0 ? "+" : ""}${delta[dominantGain[0] as keyof typeof delta]}.` : "",
    swarmChanged
      ? `Swarm composition changed: run ${runA} used ${mA.selectedAgents.map((a) => a.name).join(", ")}; run ${runB} used ${mB.selectedAgents.map((a) => a.name).join(", ")}.`
      : "Same swarm composition.",
    mB.improvementFromPrevious?.message ?? "",
  ].filter(Boolean).join(" ");

  return { runA: mA, runB: mB, delta, explanation };
}

// ── Redis clear ───────────────────────────────────────────────────────────────

export async function clearMarketHistory(): Promise<void> {
  clearInMemoryStreams();
  clearInMemoryAnomalies();
  resetLocalTDigestFallback();

  const clearedRedis = await safeRedis("clearMarketHistory", async (client) => {
    const missionIds = await client.zRange(KEY.missionsIndex, 0, -1);
    const taskTypes = ["market_research", "positioning", "landing_page_copy", "pitch_script", "risk_review", "final_eval"];
    const keysToDelete = [
      KEY.missionsIndex, KEY.marketFeed,
      KEY.lbReputation, KEY.lbBayesian, KEY.lbElo, KEY.lbUncertainty,
      KEY.agentLeaderboardFactuality, KEY.agentLeaderboardMarketValue,
      KEY.streamMarketEvents, KEY.streamEvaluations,
      KEY.anomaliesIndex, KEY.tdigestPriceGlobal,
      KEY.tdigestLatencyGlobal, KEY.tdigestScoreDeltaGlobal,
      KEY.tdigestCostQualityGlobal, KEY.tdigestProbe,
      ...missionIds.flatMap((id) => [KEY.mission(id), KEY.missionEvents(id)]),
      ...taskTypes.flatMap((t) => [KEY.tdigestPriceTask(t), KEY.tdigestBidPriceTask(t)]),
    ];
    if (keysToDelete.length > 0) await client.del(keysToDelete);
    return true;
  }, false);

  if (!clearedRedis) {
    inMemMissions.clear();
    inMemMissionOrder.length = 0;
    inMemEvents.clear();
    inMemFeed.length = 0;
    inMemAgentHistory.clear();
  }
}

export function isRedisConnected(): boolean {
  return isRedisEnabled();
}
