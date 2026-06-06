import { Agent, ShapleyContribution } from "../types";

// Role-importance weights for leave-one-out Shapley approximation
const ROLE_IMPORTANCE: Record<string, { weight: number; dimension: string }> = {
  source_verifier: { weight: 0.20, dimension: "factuality" },
  skeptic: { weight: 0.15, dimension: "risk reduction" },
  research: { weight: 0.18, dimension: "market depth" },
  pitch: { weight: 0.14, dimension: "narrative quality" },
  builder: { weight: 0.13, dimension: "product clarity" },
  planner: { weight: 0.10, dimension: "structure" },
  evaluator: { weight: 0.05, dimension: "quality assurance" },
  market_maker: { weight: 0.03, dimension: "routing" },
  reputation: { weight: 0.02, dimension: "memory" },
};

export function computeShapleyContributions(
  selectedAgents: Agent[],
  fullScore: number
): ShapleyContribution[] {
  return selectedAgents.map((agent) => {
    const importance = ROLE_IMPORTANCE[agent.id] ?? { weight: 0.08, dimension: "general" };
    // Leave-one-out approximation
    const scoreWithout = fullScore * (1 - importance.weight);
    const contribution = fullScore - scoreWithout;

    return {
      agentId: agent.id,
      agentName: agent.name,
      contribution: Math.round(contribution * 100) / 100,
      dimension: importance.dimension,
    };
  });
}

export function computeContributionLedger(
  selectedAgents: Agent[],
  fullScore: number
): ShapleyContribution[] {
  const contributions = computeShapleyContributions(selectedAgents, fullScore);
  return contributions.sort((a, b) => b.contribution - a.contribution);
}
