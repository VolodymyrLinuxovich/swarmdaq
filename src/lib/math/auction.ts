import { Agent, AgentBid } from "../types";
import { clamp01, normalize } from "./agentMath";

export function computeUtilityBid(
  agent: Agent,
  taskId: string,
  skillMatch: number
): AgentBid {
  const trustScore = agent.bayesianMean;
  const confidence = clamp01(agent.factuality);
  const maxCost = 0.10;
  const maxLatency = 3.0;

  const normalizedCost = normalize(agent.price, 0, maxCost);
  const normalizedLatency = normalize(agent.latencyAvg, 0, maxLatency);
  const expectedQuality = clamp01(
    0.4 * skillMatch + 0.3 * trustScore + 0.3 * confidence
  );
  const risk = clamp01(agent.uncertainty * 2);

  const utilityBid =
    0.4 * expectedQuality +
    0.25 * confidence +
    0.2 * trustScore -
    0.1 * normalizedCost -
    0.05 * normalizedLatency -
    0.1 * risk;

  return {
    agentId: agent.id,
    taskId,
    confidence,
    cost: agent.price,
    latency: agent.latencyAvg,
    expectedQuality,
    risk,
    utilityBid: clamp01(utilityBid),
    reason: `Skill match ${(skillMatch * 100).toFixed(0)}% | Trust ${(trustScore * 100).toFixed(0)}% | Uncertainty ${(risk * 100).toFixed(0)}%`,
  };
}

export function runAuction(
  agents: Agent[],
  taskId: string,
  requiredSkills: string[]
): AgentBid[] {
  const bids = agents.map((agent) => {
    const skillMatch =
      requiredSkills.filter((s) => agent.skills.includes(s)).length /
      Math.max(requiredSkills.length, 1);
    return computeUtilityBid(agent, taskId, skillMatch);
  });

  bids.sort((a, b) => b.utilityBid - a.utilityBid);

  // Vickrey-inspired: winner pays clearing price of second-best bid
  if (bids.length > 0) bids[0].isWinner = true;
  if (bids.length > 1) bids[0].clearingPrice = bids[1].cost;

  return bids;
}
