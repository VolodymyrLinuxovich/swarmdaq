import { describe, it, expect } from "vitest";
import { updateBayesianReputation, updateElo } from "../math/reputation";
import type { Agent } from "../types";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test",
    name: "TestAgent",
    role: "tester",
    skills: [],
    price: 0.01,
    reputation: 70,
    factuality: 0.7,
    usefulness: 0.7,
    collaboration: 0.7,
    latencyAvg: 1,
    status: "idle",
    alpha: 2,
    beta: 1,
    meanReward: 0.7,
    uncertainty: 0.1,
    runs: 5,
    wins: 3,
    losses: 1,
    elo: 1450,
    ucbScore: 0.5,
    graphTrust: 0.5,
    bayesianMean: 0.667, // alpha/(alpha+beta) = 2/3
    ...overrides,
  };
}

describe("updateBayesianReputation", () => {
  it("positive outcome increases bayesianMean", () => {
    const agent = makeAgent({ alpha: 2, beta: 2, bayesianMean: 0.5 });
    const result = updateBayesianReputation(agent, 1.0);
    expect(result.bayesianMean).toBeGreaterThan(0.5);
  });

  it("negative outcome (score=0) decreases bayesianMean", () => {
    const agent = makeAgent({ alpha: 3, beta: 1, bayesianMean: 0.75 });
    const result = updateBayesianReputation(agent, 0.0);
    expect(result.bayesianMean).toBeLessThan(0.75);
  });

  it("experienced agent has lower uncertainty than new agent given same score", () => {
    // New agent: low alpha+beta
    const newAgent = makeAgent({ alpha: 1, beta: 1 });
    // Experienced agent: high alpha+beta
    const expAgent = makeAgent({ alpha: 20, beta: 5 });

    const newResult = updateBayesianReputation(newAgent, 0.8);
    const expResult = updateBayesianReputation(expAgent, 0.8);

    // More evidence = lower uncertainty
    expect(expResult.uncertainty).toBeLessThan(newResult.uncertainty);
  });

  it("bayesianMean stays within [0, 1]", () => {
    const agent = makeAgent({ alpha: 1, beta: 1 });
    const result = updateBayesianReputation(agent, 0.99);
    expect(result.bayesianMean).toBeGreaterThanOrEqual(0);
    expect(result.bayesianMean).toBeLessThanOrEqual(1);
  });

  it("alpha and beta are updated correctly", () => {
    const agent = makeAgent({ alpha: 2, beta: 3 });
    const score = 0.6;
    const result = updateBayesianReputation(agent, score);
    expect(result.alpha).toBeCloseTo(2 + score, 5);
    expect(result.beta).toBeCloseTo(3 + (1 - score), 5);
  });
});

describe("updateElo", () => {
  it("win increases rating", () => {
    const { newRatingA } = updateElo(1500, 1500, 1);
    expect(newRatingA).toBeGreaterThan(1500);
  });

  it("loss decreases rating", () => {
    const { newRatingA } = updateElo(1500, 1500, 0);
    expect(newRatingA).toBeLessThan(1500);
  });

  it("tie keeps rating roughly the same when evenly matched", () => {
    const { newRatingA } = updateElo(1500, 1500, 0.5);
    expect(newRatingA).toBeCloseTo(1500, 5);
  });

  it("deltaA is positive for a win", () => {
    const { deltaA } = updateElo(1500, 1500, 1);
    expect(deltaA).toBeGreaterThan(0);
  });

  it("deltaA is negative for a loss", () => {
    const { deltaA } = updateElo(1500, 1500, 0);
    expect(deltaA).toBeLessThan(0);
  });

  it("strong player gains less from winning against weak opponent", () => {
    const { deltaA: strongWins } = updateElo(1800, 1200, 1);
    const { deltaA: evenWins } = updateElo(1500, 1500, 1);
    // Expected win for strong player → smaller delta
    expect(strongWins).toBeLessThan(evenWins);
  });

  it("weak player gains more from upset win", () => {
    const { deltaA: upsetWin } = updateElo(1200, 1800, 1);
    const { deltaA: evenWin } = updateElo(1500, 1500, 1);
    expect(upsetWin).toBeGreaterThan(evenWin);
  });
});
