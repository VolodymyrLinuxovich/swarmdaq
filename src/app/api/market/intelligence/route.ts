import { NextResponse } from "next/server";
import { getAgents } from "@/lib/memory";
import { isRedisEnabled } from "@/lib/redis";
import { KEY } from "@/lib/redis/keys";
import { getRecentMarketEvents, getStreamLength } from "@/lib/redis/streams";
import { getTDigestQuantiles, getTDigestRuntimeStatus } from "@/lib/redis/tdigest";
import { getRecentAnomalies } from "@/lib/market/price-anomaly";
import { getRecentMissions } from "@/lib/marketHistory";

export const runtime = "nodejs";
export const revalidate = 0;

interface PriceStats {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface MarketIntelligenceResponse {
  redisEnabled: boolean;
  tdigestEnabled: boolean;
  tdigestMode: "redis-tdigest" | "rolling-quantile" | "in-memory";
  tdigestReason: string | null;
  totalEvents: number;
  topAgents: Array<{
    id: string;
    name: string;
    reputation: number;
    elo: number;
    factuality: number;
    marketValue: number;
  }>;
  recentAnomalies: Awaited<ReturnType<typeof getRecentAnomalies>>;
  globalPriceStats: PriceStats | null;
  latestRunMarketSummary: {
    missionId: string;
    runNumber: number;
    overallScore: number;
    selectedAgents: string[];
    recentEvents: Awaited<ReturnType<typeof getRecentMarketEvents>>;
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

export async function GET() {
  const [agents, tdigestStatus, totalEvents, recentAnomalies, priceQ, missions, recentEvents] = await Promise.all([
    getAgents(),
    getTDigestRuntimeStatus(),
    getStreamLength(KEY.streamMarketEvents),
    getRecentAnomalies(5),
    getTDigestQuantiles(KEY.tdigestPriceGlobal, [0.5, 0.9, 0.95, 0.99]),
    getRecentMissions(1),
    getRecentMarketEvents(8),
  ]);

  const topAgents = [...agents]
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 5)
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      reputation: agent.reputation,
      elo: agent.elo,
      factuality: Math.round(agent.factuality * 100),
      marketValue: marketValue(agent),
    }));

  const latest = missions[0];
  const response: MarketIntelligenceResponse = {
    redisEnabled: isRedisEnabled(),
    tdigestEnabled: tdigestStatus.tdigestEnabled,
    tdigestMode: tdigestStatus.mode,
    tdigestReason: tdigestStatus.reason,
    totalEvents,
    topAgents,
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
          recentEvents,
        }
      : null,
  };

  return NextResponse.json(response);
}
