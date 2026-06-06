import { Agent, SwarmPortfolio } from "../types";
import { clamp01 } from "./agentMath";

const LAMBDA_RISK = 0.35;
const LAMBDA_COST = 0.15;

// Known good pairings that boost synergy
const SYNERGY_PAIRS: Array<[string, string, number]> = [
  ["research", "source_verifier", 0.12],
  ["planner", "evaluator", 0.08],
  ["pitch", "skeptic", 0.07],
  ["builder", "pitch", 0.06],
  ["skeptic", "source_verifier", 0.09],
];

export function computeSynergyBonus(agentIds: string[]): number {
  let bonus = 0;
  for (const [a, b, value] of SYNERGY_PAIRS) {
    if (agentIds.includes(a) && agentIds.includes(b)) {
      bonus += value;
    }
  }
  return clamp01(bonus);
}

export function computeSwarmPortfolio(agents: Agent[]): SwarmPortfolio {
  if (agents.length === 0) {
    return {
      agentIds: [],
      expectedReturn: 0,
      variance: 0,
      totalCost: 0,
      synergyBonus: 0,
      objective: 0,
    };
  }

  const agentIds = agents.map((a) => a.id);
  const expectedReturn =
    agents.reduce((s, a) => s + a.bayesianMean, 0) / agents.length;

  // Variance = average uncertainty + pairwise risk penalty
  const avgUncertainty =
    agents.reduce((s, a) => s + a.uncertainty, 0) / agents.length;
  // Pairwise risk: penalize if two high-uncertainty agents pair together
  let pairwiseRisk = 0;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      pairwiseRisk += agents[i].uncertainty * agents[j].uncertainty * 0.1;
    }
  }
  const variance = clamp01(avgUncertainty + pairwiseRisk);

  const totalCost = agents.reduce((s, a) => s + a.price, 0);
  const normalizedCost = clamp01(totalCost / 0.5); // max expected total ~$0.50
  const synergyBonus = computeSynergyBonus(agentIds);

  const objective =
    expectedReturn -
    LAMBDA_RISK * variance -
    LAMBDA_COST * normalizedCost +
    synergyBonus;

  return {
    agentIds,
    expectedReturn,
    variance,
    totalCost,
    synergyBonus,
    objective: clamp01(objective),
  };
}
