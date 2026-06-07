import { NextResponse } from "next/server";
import { getAgents } from "@/lib/memory";
import { isRedisEnabled } from "@/lib/redis";
import { KEY } from "@/lib/redis/keys";
import { getRecentMarketEvents, getStreamLength } from "@/lib/redis/streams";
import { getTDigestQuantiles, getTDigestRuntimeStatus, getTDigestFallbackMode } from "@/lib/redis/tdigest";
import { getRecentAnomalies } from "@/lib/market/price-anomaly";
import { getRecentMissions } from "@/lib/marketHistory";
import { isMem0Enabled } from "@/lib/memory/mem0";

export const runtime = "nodejs";
export const revalidate = 0;

interface PriceStats {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

interface AgentSummary {
  id: string;
  name: string;
  reputation: number;
  elo: number;
  factuality: number;
  marketValue: number;
}

export interface MarketIntelligenceResponse {
  redisEnabled: boolean;
  redisProvider: "redis-cloud" | "upstash" | "none";
  tdigestEnabled: boolean;
  tdigestMode: "redis-tdigest" | "rolling-quantile" | "in-memory";
  tdigestFallbackMode: "native" | "redis-list" | "local-memory" | "disabled";
  tdigestReason: string | null;
  mem0Enabled: boolean;
  totalEvents: number;
  topAgentsByReputation: AgentSummary[];
  topAgentsByElo: AgentSummary[];
  topAgentsByFactuality: AgentSummary[];
  recentMarketEvents: Awaited<ReturnType<typeof getRecentMarketEvents>>;
  recentAnomalies: Awaited<ReturnType<typeof getRecentAnomalies>>;
  globalPriceStats: PriceStats | null;
  latestRunMarketSummary: {
    missionId: string;
    runNumber: number;
    overallScore: number;
    selectedAgents: string[];
  } | null;
}

function marketValue(agent: Awaited<ReturnType<typeof getAgents>>[number]): number {
  return Math.round(
    agent.reputation * 0.35 +
    agent.elo / 20 +
    agent.bayesianMean * 30 +
    agent.factuality * 20 -
    agent.price * 120 -
    agent.uncertainty * 25,
  );
}

function toAgentSummary(agent: Awaited<ReturnType<typeof getAgents>>[number]): AgentSummary {
  return {
    id: agent.id,
    name: agent.name,
    reputation: agent.reputation,
    elo: agent.elo,
    factuality: Math.round(agent.factuality * 100),
    marketValue: marketValue(agent),
  };
}

function redisProvider(): "upstash" | "redis-cloud" | "none" {
  if (!isRedisEnabled()) {
    return Boolean(process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_PASSWORD))
      ? "redis-cloud"
      : "none";
  }
  return process.env.UPSTASH_REDIS_REST_URL ? "upstash" : "redis-cloud";
}

export async function GET() {
  const [agents, tdigestStatus, tdigestFbMode, totalEvents, recentAnomalies, priceQ, missions, recentMarketEvents] =
    await Promise.all([
      getAgents(),
      getTDigestRuntimeStatus(),
      getTDigestFallbackMode(),
      getStreamLength(KEY.streamMarketEvents),
      getRecentAnomalies(5),
      getTDigestQuantiles(KEY.tdigestPriceGlobal, [0.5, 0.9, 0.95, 0.99]),
      getRecentMissions(1),
      getRecentMarketEvents(8),
    ]);

  const sorted = [...agents];
  const byReputation = [...sorted].sort((a, b) => b.reputation - a.reputation).slice(0, 5).map(toAgentSummary);
  const byElo = [...sorted].sort((a, b) => b.elo - a.elo).slice(0, 5).map(toAgentSummary);
  const byFactuality = [...sorted].sort((a, b) => b.factuality - a.factuality).slice(0, 5).map(toAgentSummary);

  const latest = missions[0];
  const response: MarketIntelligenceResponse = {
    redisEnabled: isRedisEnabled(),
    redisProvider: redisProvider(),
    tdigestEnabled: tdigestStatus.tdigestEnabled,
    tdigestMode: tdigestStatus.mode,
    tdigestFallbackMode: tdigestFbMode,
    tdigestReason: tdigestStatus.reason,
    mem0Enabled: isMem0Enabled(),
    totalEvents,
    topAgentsByReputation: byReputation,
    topAgentsByElo: byElo,
    topAgentsByFactuality: byFactuality,
    recentMarketEvents,
    recentAnomalies,
    globalPriceStats: priceQ
      ? {
          p50: Number(priceQ[0].toFixed(4)),
          p90: Number(priceQ[1].toFixed(4)),
          p95: Number(priceQ[2].toFixed(4)),
          p99: Number(priceQ[3].toFixed(4)),
        }
      : null,
    latestRunMarketSummary: latest
      ? {
          missionId: latest.missionId,
          runNumber: latest.runNumber,
          overallScore: latest.overallScore,
          selectedAgents: latest.selectedAgents,
        }
      : null,
  };

  return NextResponse.json(response);
}
