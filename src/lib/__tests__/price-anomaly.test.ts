import { describe, expect, it } from "vitest";
import {
  classifyPricePattern,
  computePValueFromCDF,
  priceAnomalyRankingSignal,
  type PriceAnomalyResult,
} from "../market/price-anomaly";
import type { Agent } from "../types";

function anomaly(overrides: Partial<PriceAnomalyResult>): PriceAnomalyResult {
  return {
    label: "NORMAL_PRICE",
    percentile: 50,
    pValue: 0.5,
    anomalyScore: 0.5,
    sampleSize: 100,
    historicalMedian: 0.05,
    historicalP90: 0.08,
    historicalP95: 0.09,
    historicalP99: 0.1,
    cdf: 0.5,
    ...overrides,
  };
}

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "research",
    name: "ResearchAgent",
    role: "research",
    skills: ["research"],
    price: 0.09,
    reputation: 90,
    factuality: 0.94,
    usefulness: 0.85,
    collaboration: 0.8,
    latencyAvg: 1.5,
    status: "idle",
    alpha: 8,
    beta: 2,
    meanReward: 0.8,
    uncertainty: 0.06,
    runs: 10,
    wins: 8,
    losses: 1,
    elo: 1510,
    ucbScore: 0,
    graphTrust: 0.8,
    bayesianMean: 0.82,
    ...overrides,
  };
}

describe("p-value price anomaly math", () => {
  it("computes two-sided p-value and anomaly score from CDF", () => {
    const result = computePValueFromCDF(0.98);
    expect(result.upperTail).toBeCloseTo(0.02, 5);
    expect(result.twoSidedP).toBeCloseTo(0.04, 5);
    expect(result.anomalyScore).toBeCloseTo(0.96, 5);
  });

  it("classifies insufficient history", () => {
    expect(classifyPricePattern({ price: 0.05, cdf: 0.5, pValue: 0.5, sampleSize: 4, historicalMedian: 0.05 })).toBe("INSUFFICIENT_HISTORY");
  });

  it("classifies upper-tail anomalies", () => {
    expect(classifyPricePattern({ price: 0.11, cdf: 0.98, pValue: 0.04, sampleSize: 50, historicalMedian: 0.05 })).toBe("OVERPRICED_AGENT");
    expect(classifyPricePattern({ price: 0.14, cdf: 0.997, pValue: 0.006, sampleSize: 50, historicalMedian: 0.05 })).toBe("MARKET_SPIKE");
  });

  it("classifies lower-tail anomalies", () => {
    expect(classifyPricePattern({ price: 0.01, cdf: 0.02, pValue: 0.04, sampleSize: 50, historicalMedian: 0.05 })).toBe("UNDERPRICED_AGENT");
    expect(classifyPricePattern({ price: 0.005, cdf: 0.004, pValue: 0.008, sampleSize: 50, historicalMedian: 0.05 })).toBe("MARKET_CRASH");
  });

  it("does not punish high prices when quality signals justify them", () => {
    const justified = priceAnomalyRankingSignal({
      anomaly: anomaly({ label: "MARKET_SPIKE", pValue: 0.005, anomalyScore: 0.99 }),
      agent: agent({ reputation: 93, factuality: 0.96 }),
      taskComplexity: 0.8,
    });
    const unjustified = priceAnomalyRankingSignal({
      anomaly: anomaly({ label: "MARKET_SPIKE", pValue: 0.005, anomalyScore: 0.99 }),
      agent: agent({ reputation: 60, factuality: 0.62, bayesianMean: 0.55, uncertainty: 0.2 }),
      taskComplexity: 0.2,
    });

    expect(justified).toBeGreaterThan(0.5);
    expect(unjustified).toBeLessThan(0.5);
  });
});
