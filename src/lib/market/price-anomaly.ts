import type { Agent } from "../types";
import { clamp01 } from "../math/agentMath";
import { KEY, isRedisEnabled, safeRedis } from "../redis";
import {
  addTDigestValue,
  getTDigestCDF,
  getTDigestInfo,
  getTDigestQuantiles,
} from "../redis/tdigest";

export type PricePatternLabel =
  | "UNDERPRICED_AGENT"
  | "OVERPRICED_AGENT"
  | "MARKET_SPIKE"
  | "MARKET_CRASH"
  | "NORMAL_PRICE"
  | "INSUFFICIENT_HISTORY";

export type AnomalySeverity =
  | "EXTREME_ANOMALY"
  | "SIGNIFICANT_ANOMALY"
  | "MILD_ANOMALY"
  | "NORMAL";

export interface PriceAnomalyResult {
  label: PricePatternLabel;
  severity: AnomalySeverity;
  percentile: number | null;
  pValue: number | null;
  anomalyScore: number;
  sampleSize: number;
  historicalMedian: number | null;
  historicalP90: number | null;
  historicalP95: number | null;
  historicalP99: number | null;
  cdf: number | null;
  explanationShort: string;
}

export interface StoredMarketAnomaly extends PriceAnomalyResult {
  timestamp: number;
  runId: string;
  missionId: string;
  taskType: string;
  agentId: string;
  agentName: string;
  price: number;
  clearingPrice?: number;
  explanation?: string;
}

const inMemoryAnomalies: StoredMarketAnomaly[] = [];

export function classifySeverity(pValue: number | null): AnomalySeverity {
  if (pValue === null) return "NORMAL";
  if (pValue < 0.01) return "EXTREME_ANOMALY";
  if (pValue < 0.05) return "SIGNIFICANT_ANOMALY";
  if (pValue < 0.10) return "MILD_ANOMALY";
  return "NORMAL";
}

function buildExplanationShort(label: PricePatternLabel, severity: AnomalySeverity, pValue: number | null, sampleSize: number): string {
  if (label === "INSUFFICIENT_HISTORY") return `Insufficient history (n=${sampleSize}); classification deferred.`;
  if (label === "NORMAL_PRICE") return "Price is within normal historical range.";
  const p = pValue !== null ? `p=${pValue.toFixed(4)}` : "";
  const sev = severity.replace(/_/g, " ").toLowerCase();
  switch (label) {
    case "UNDERPRICED_AGENT": return `Agent is priced below historical norm — ${sev} (${p}).`;
    case "OVERPRICED_AGENT": return `Agent is priced above historical norm — ${sev} (${p}).`;
    case "MARKET_SPIKE": return `Extreme upward price spike detected — ${sev} (${p}).`;
    case "MARKET_CRASH": return `Extreme downward price collapse detected — ${sev} (${p}).`;
    default: return "Price anomaly detected.";
  }
}

export function computePValueFromCDF(cdf: number): {
  lowerTail: number;
  upperTail: number;
  twoSidedP: number;
  anomalyScore: number;
} {
  const lowerTail = clamp01(cdf);
  const upperTail = clamp01(1 - lowerTail);
  const twoSidedP = clamp01(2 * Math.min(lowerTail, upperTail));
  return { lowerTail, upperTail, twoSidedP, anomalyScore: clamp01(1 - twoSidedP) };
}

export function classifyPricePattern(params: {
  price: number;
  cdf: number | null;
  pValue: number | null;
  sampleSize: number;
  historicalMedian: number | null;
}): PricePatternLabel {
  if (params.sampleSize < 5 || params.cdf === null || params.pValue === null || params.historicalMedian === null) {
    return "INSUFFICIENT_HISTORY";
  }
  if (params.pValue >= 0.10) return "NORMAL_PRICE";
  const isUpperTail = params.price >= params.historicalMedian;
  if (params.pValue < 0.01) return isUpperTail ? "MARKET_SPIKE" : "MARKET_CRASH";
  return isUpperTail ? "OVERPRICED_AGENT" : "UNDERPRICED_AGENT";
}

function quantileKey(taskType: string, metric: "bid" | "clearing" | "global" = "clearing"): string {
  if (metric === "bid") return KEY.tdigestBidPriceTask(taskType);
  if (metric === "global") return KEY.tdigestPriceGlobal;
  return KEY.tdigestPriceTask(taskType);
}

export async function computePriceAnomaly(params: {
  price: number;
  taskType: string;
  metric?: "bid" | "clearing" | "global";
}): Promise<PriceAnomalyResult> {
  const key = quantileKey(params.taskType, params.metric ?? "clearing");
  const [cdf, quantiles, info] = await Promise.all([
    getTDigestCDF(key, params.price),
    getTDigestQuantiles(key, [0.5, 0.9, 0.95, 0.99]),
    getTDigestInfo(key),
  ]);

  const sampleSize = info.sampleSize ?? 0;
  const historicalMedian = quantiles?.[0] ?? null;
  const p = cdf === null ? null : computePValueFromCDF(cdf);
  const pValue = p?.twoSidedP ?? null;
  const label = classifyPricePattern({
    price: params.price,
    cdf,
    pValue,
    sampleSize,
    historicalMedian,
  });

  const severity = classifySeverity(pValue);
  return {
    label,
    severity,
    percentile: cdf === null ? null : Math.round(cdf * 1000) / 10,
    pValue: pValue === null ? null : Math.round(pValue * 10000) / 10000,
    anomalyScore: p ? Math.round(p.anomalyScore * 10000) / 10000 : 0,
    sampleSize,
    historicalMedian,
    historicalP90: quantiles?.[1] ?? null,
    historicalP95: quantiles?.[2] ?? null,
    historicalP99: quantiles?.[3] ?? null,
    cdf,
    explanationShort: buildExplanationShort(label, severity, pValue, sampleSize),
  };
}

export function priceAnomalyRankingSignal(params: {
  anomaly: PriceAnomalyResult;
  agent: Agent;
  taskComplexity: number;
}): number {
  const { anomaly, agent, taskComplexity } = params;
  if (anomaly.label === "INSUFFICIENT_HISTORY" || anomaly.label === "NORMAL_PRICE") return 0.5;

  const justifiedByQuality =
    agent.reputation >= 86 ||
    agent.factuality >= 0.9 ||
    agent.bayesianMean >= 0.82 ||
    taskComplexity >= 0.75;
  const strength = anomaly.anomalyScore;

  if (anomaly.label === "UNDERPRICED_AGENT" || anomaly.label === "MARKET_CRASH") {
    return clamp01(0.62 + strength * 0.22);
  }
  if (justifiedByQuality) {
    return clamp01(0.48 + strength * 0.24);
  }
  return clamp01(0.42 - strength * 0.28);
}

export async function recordBidPrice(taskType: string, price: number): Promise<void> {
  await addTDigestValue(KEY.tdigestBidPriceTask(taskType), price);
}

export async function recordClearingPrice(taskType: string, price: number): Promise<void> {
  await Promise.all([
    addTDigestValue(KEY.tdigestPriceTask(taskType), price),
    addTDigestValue(KEY.tdigestPriceGlobal, price),
  ]);
}

export async function recordEvaluationMarketMetrics(params: {
  latencyMs: number;
  scoreDelta: number;
  costPerQualityPoint: number;
}): Promise<void> {
  await Promise.all([
    addTDigestValue(KEY.tdigestLatencyGlobal, params.latencyMs),
    addTDigestValue(KEY.tdigestScoreDeltaGlobal, params.scoreDelta),
    addTDigestValue(KEY.tdigestCostQualityGlobal, params.costPerQualityPoint),
  ]);
}

export async function storeMarketAnomaly(anomaly: StoredMarketAnomaly): Promise<void> {
  inMemoryAnomalies.unshift(anomaly);
  if (inMemoryAnomalies.length > 100) inMemoryAnomalies.pop();
  if (!isRedisEnabled()) return;

  const encoded = JSON.stringify(anomaly);
  await safeRedis("storeMarketAnomaly", async (client) => {
    await Promise.all([
      client.lPush(KEY.anomaly(anomaly.runId), encoded),
      client.lTrim(KEY.anomaly(anomaly.runId), 0, 49),
      client.expire(KEY.anomaly(anomaly.runId), 86400 * 7),
      client.zAdd(KEY.anomaliesIndex, { score: anomaly.timestamp, value: encoded }),
      client.zRemRangeByRank(KEY.anomaliesIndex, 0, -101),
    ]);
  }, undefined);
}

export async function getRecentAnomalies(limit = 10): Promise<StoredMarketAnomaly[]> {
  if (!isRedisEnabled()) return inMemoryAnomalies.slice(0, limit);
  return safeRedis(
    "getRecentAnomalies",
    async (client) => {
      const raw = await client.zRange(KEY.anomaliesIndex, 0, limit - 1, { REV: true });
      return raw
        .map((item) => {
          try { return JSON.parse(item) as StoredMarketAnomaly; } catch { return null; }
        })
        .filter((item): item is StoredMarketAnomaly => item !== null);
    },
    inMemoryAnomalies.slice(0, limit),
  );
}

export function clearInMemoryAnomalies(): void {
  inMemoryAnomalies.length = 0;
}
