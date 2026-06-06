import { describe, it, expect } from "vitest";
import { normalizeElo } from "../math/reputation";
import { weightedSum, clamp01 } from "../math/agentMath";

describe("normalizeElo", () => {
  it("returns 0 for elo=1200 (lower bound)", () => {
    expect(normalizeElo(1200)).toBe(0);
  });

  it("returns 1 for elo=1800 (upper bound)", () => {
    expect(normalizeElo(1800)).toBe(1);
  });

  it("returns 0.5 for elo=1500 (midpoint)", () => {
    expect(normalizeElo(1500)).toBeCloseTo(0.5, 5);
  });

  it("clamps to 0 below 1200", () => {
    expect(normalizeElo(1000)).toBe(0);
  });

  it("clamps to 1 above 1800", () => {
    expect(normalizeElo(2000)).toBe(1);
  });
});

describe("weightedSum", () => {
  it("clamps result to 0-1", () => {
    // Extreme values that would exceed 1 without clamping
    const result = weightedSum([
      { weight: 2.0, value: 1.0 },
      { weight: 2.0, value: 1.0 },
    ]);
    expect(result).toBeLessThanOrEqual(1);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("clamps result to 0 for negative weights", () => {
    const result = weightedSum([
      { weight: -2.0, value: 1.0 },
    ]);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("higher skill match produces higher score", () => {
    // Simulate two agents with different skill matches but same other params
    const baseComponents = [
      { weight: 0.18, value: 0.7 }, // bayesianMean
      { weight: 0.16, value: 0.6 }, // ucb
      { weight: 0.14, value: 0.5 }, // utilityBid
      { weight: 0.12, value: normalizeElo(1450) }, // elo
      { weight: 0.08, value: 0.5 }, // graphTrust
      { weight: 0.07, value: 0.6 }, // collaboration
      { weight: 0.05, value: 0.5 }, // factuality
      { weight: -0.05, value: 0.3 }, // price (negative)
      { weight: -0.05, value: 0.4 }, // latency (negative)
      { weight: -0.10, value: 0.2 }, // uncertainty (negative)
    ];

    const highSkillScore = weightedSum([
      { weight: 0.20, value: 1.0 }, // perfect skill match
      ...baseComponents,
    ]);
    const lowSkillScore = weightedSum([
      { weight: 0.20, value: 0.0 }, // no skill match
      ...baseComponents,
    ]);

    expect(highSkillScore).toBeGreaterThan(lowSkillScore);
  });

  it("returns 0 for empty components", () => {
    expect(weightedSum([])).toBe(0);
  });
});

describe("clamp01", () => {
  it("returns value unchanged when in [0,1]", () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });

  it("clamps negative values to 0", () => {
    expect(clamp01(-1)).toBe(0);
  });

  it("clamps values > 1 to 1", () => {
    expect(clamp01(1.5)).toBe(1);
  });
});
