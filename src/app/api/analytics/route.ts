import { NextResponse } from "next/server";
import { KEY } from "@/lib/redis";
import { getTDigestQuantiles } from "@/lib/tdigest";

export const runtime = "nodejs";
export const revalidate = 0;

const DIMS = ["quality", "factuality", "usefulness", "specificity", "actionability", "collaboration"] as const;
type Dim = (typeof DIMS)[number];

interface QuantileTrio { p50: number; p90: number; p95: number }
interface QuantileQuad extends QuantileTrio { p99: number }

export interface AnalyticsResponse {
  available: boolean;
  scoreOverall: QuantileTrio | null;
  scoreDimensions: Record<Dim, QuantileTrio> | null;
  latency: QuantileQuad | null;
}

export async function GET() {
  const [overallQ, ...dimQs] = await Promise.all([
    getTDigestQuantiles(KEY.tdScoreOverall, [0.5, 0.9, 0.95]),
    ...DIMS.map((d) => getTDigestQuantiles(KEY.tdScoreDimension(d), [0.5, 0.9, 0.95])),
  ]);

  const latencyQ = await getTDigestQuantiles(KEY.tdLatencyGlobal, [0.5, 0.9, 0.95, 0.99]);

  const available = overallQ !== null;

  const response: AnalyticsResponse = {
    available,
    scoreOverall: overallQ
      ? { p50: Math.round(overallQ[0]), p90: Math.round(overallQ[1]), p95: Math.round(overallQ[2]) }
      : null,
    scoreDimensions: dimQs.some(Boolean)
      ? Object.fromEntries(
          DIMS.map((d, i) => [
            d,
            dimQs[i]
              ? { p50: Math.round(dimQs[i]![0]), p90: Math.round(dimQs[i]![1]), p95: Math.round(dimQs[i]![2]) }
              : null,
          ]).filter(([, v]) => v !== null),
        ) as Record<Dim, QuantileTrio>
      : null,
    latency: latencyQ
      ? {
          p50: Math.round(latencyQ[0]),
          p90: Math.round(latencyQ[1]),
          p95: Math.round(latencyQ[2]),
          p99: Math.round(latencyQ[3]),
        }
      : null,
  };

  return NextResponse.json(response);
}
