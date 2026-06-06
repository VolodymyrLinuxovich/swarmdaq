import { Agent } from "../types";
import { clamp01 } from "./agentMath";

const EXPLORATION_C = 1.4;

export function computeUCB1(
  agent: Agent,
  totalRuns: number
): number {
  const mean = clamp01(agent.meanReward);
  const exploration =
    EXPLORATION_C *
    Math.sqrt(Math.log(totalRuns + 1) / (agent.runs + 1));
  return clamp01(mean + exploration);
}

export function updateMeanReward(agent: Agent, reward: number): number {
  const r = clamp01(reward);
  return (agent.meanReward * agent.runs + r) / (agent.runs + 1);
}

export function computeAllUCB1(
  agents: Agent[],
  totalRuns: number
): Record<string, number> {
  return Object.fromEntries(
    agents.map((a) => [a.id, computeUCB1(a, totalRuns)])
  );
}
