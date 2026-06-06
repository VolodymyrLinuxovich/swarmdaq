import { Agent } from "../types";
import { clamp01 } from "./agentMath";

export function updateBayesianReputation(
  agent: Agent,
  score: number
): { alpha: number; beta: number; bayesianMean: number; uncertainty: number } {
  const r = clamp01(score);
  const alpha = agent.alpha + r;
  const beta = agent.beta + (1 - r);
  const bayesianMean = alpha / (alpha + beta);
  const uncertainty = Math.sqrt(
    (alpha * beta) /
      ((alpha + beta) ** 2 * (alpha + beta + 1))
  );
  return { alpha, beta, bayesianMean, uncertainty };
}

export function updateElo(
  ratingA: number,
  ratingB: number,
  actualA: number, // 1 = A wins, 0.5 = tie, 0 = B wins
  K = 24
): { newRatingA: number; newRatingB: number; deltaA: number } {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const deltaA = K * (actualA - expectedA);
  return {
    newRatingA: ratingA + deltaA,
    newRatingB: ratingB - deltaA,
    deltaA,
  };
}

export function bradleyTerryProbability(
  eloA: number,
  eloB: number
): number {
  const strengthA = Math.exp(eloA / 400);
  const strengthB = Math.exp(eloB / 400);
  return strengthA / (strengthA + strengthB);
}

export function normalizeReputation(reputation: number): number {
  return clamp01((reputation - 50) / 50);
}

export function normalizeElo(elo: number): number {
  // Elo range roughly 1200-1800 for our agents
  return clamp01((elo - 1200) / 600);
}
