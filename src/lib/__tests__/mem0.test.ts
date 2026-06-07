import { afterEach, describe, expect, it, vi } from "vitest";

describe("Mem0 fallback when MEM0_API_KEY is missing", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    vi.resetModules();
  });

  it("isMem0Enabled returns false when MEM0_API_KEY is missing", async () => {
    delete process.env.MEM0_API_KEY;
    vi.resetModules();

    const { isMem0Enabled } = await import("../memory/mem0");
    expect(isMem0Enabled()).toBe(false);
  });

  it("saveMemory returns false when MEM0_API_KEY is missing", async () => {
    delete process.env.MEM0_API_KEY;
    vi.resetModules();

    const { saveMemory } = await import("../memory/mem0");
    const result = await saveMemory({ agentId: "research", runId: "run-1", content: "test" });
    expect(result).toBe(false);
  });

  it("searchMemory returns empty array when MEM0_API_KEY is missing", async () => {
    delete process.env.MEM0_API_KEY;
    vi.resetModules();

    const { searchMemory } = await import("../memory/mem0");
    const result = await searchMemory({ agentId: "research", query: "performance" });
    expect(result).toEqual([]);
  });

  it("domain-specific saves return false when MEM0_API_KEY is missing", async () => {
    delete process.env.MEM0_API_KEY;
    vi.resetModules();

    const { saveAgentStrength, saveAgentFailure, savePriceAnomaly } = await import("../memory/mem0");
    expect(await saveAgentStrength({ agentId: "a", runId: "r", taskType: "t", score: 90, missionId: "m" })).toBe(false);
    expect(await saveAgentFailure({ agentId: "a", runId: "r", taskType: "t", score: 20, missionId: "m" })).toBe(false);
    expect(await savePriceAnomaly({ agentId: "a", runId: "r", taskType: "t", missionId: "m", priceAnomalyLabel: "MARKET_SPIKE", price: 0.15 })).toBe(false);
  });
});
