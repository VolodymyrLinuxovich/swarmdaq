import { describe, expect, it, vi } from "vitest";
import type { Agent } from "../types";
import { contextualizeMarketAnomaly } from "../market/anomaly-contextualizer";

vi.mock("../gemini", () => ({
  generateAgentOutput: vi.fn(async () => "not json"),
}));

function agent(): Agent {
  return {
    id: "research",
    name: "ResearchAgent",
    role: "research",
    skills: ["research"],
    price: 0.09,
    reputation: 91,
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
  };
}

describe("anomaly contextualizer", () => {
  it("returns deterministic fallback when LLM output is not valid JSON", async () => {
    const result = await contextualizeMarketAnomaly({
      taskType: "market_research",
      selectedAgent: agent(),
      bidPrice: 0.12,
      clearingPrice: 0.08,
      taskComplexity: 0.8,
      anomaly: {
        label: "MARKET_SPIKE",
        percentile: 99.2,
        pValue: 0.006,
        anomalyScore: 0.994,
        sampleSize: 50,
        historicalMedian: 0.05,
        historicalP90: 0.08,
        historicalP95: 0.09,
        historicalP99: 0.11,
        cdf: 0.997,
      },
    });

    expect(result.summary).toContain("ResearchAgent");
    expect(result.riskLevel).toBe("high");
    expect(result.isJustified).toBe(true);
  });
});
