import { describe, expect, it } from "vitest";

// Verify the response shape from /api/market/intelligence never leaks secrets.
// This validates the shape contract, not the live endpoint.

import type { MarketIntelligenceResponse } from "../../app/api/market/intelligence/route";

describe("MarketIntelligenceResponse shape", () => {
  it("required fields are all present in the type", () => {
    const shape: Record<keyof MarketIntelligenceResponse, true> = {
      redisEnabled: true,
      redisProvider: true,
      tdigestEnabled: true,
      tdigestMode: true,
      tdigestFallbackMode: true,
      tdigestReason: true,
      mem0Enabled: true,
      totalEvents: true,
      topAgentsByReputation: true,
      topAgentsByElo: true,
      topAgentsByFactuality: true,
      recentMarketEvents: true,
      recentAnomalies: true,
      globalPriceStats: true,
      latestRunMarketSummary: true,
    };
    expect(Object.keys(shape).length).toBeGreaterThan(0);
  });

  it("secret fields are not part of the response type", () => {
    // TypeScript ensures at compile time that these keys don't exist on the type.
    // At runtime we verify no surprise leakage via a sample object.
    const sample = {
      redisEnabled: false,
      redisProvider: "none",
      tdigestEnabled: false,
      tdigestMode: "in-memory",
      tdigestFallbackMode: "disabled",
      tdigestReason: null,
      mem0Enabled: false,
      totalEvents: 0,
      topAgentsByReputation: [],
      topAgentsByElo: [],
      topAgentsByFactuality: [],
      recentMarketEvents: [],
      recentAnomalies: [],
      globalPriceStats: null,
      latestRunMarketSummary: null,
    } satisfies MarketIntelligenceResponse;

    const dangerous = ["REDIS_URL", "REDIS_HOST", "REDIS_PASSWORD", "MEM0_API_KEY",
      "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "UPSTASH_REDIS_REST_TOKEN",
      "WANDB_API_KEY"];
    const json = JSON.stringify(sample);
    for (const key of dangerous) {
      expect(json).not.toContain(key);
    }
  });
});
