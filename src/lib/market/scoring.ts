import { weightedSum } from "../math/agentMath";

export interface MarketScoreComponents {
  skillMatch: number;
  bayesianMean: number;
  ucbScore: number;
  bidUtility: number;
  elo: number;
  graphTrust: number;
  collaboration: number;
  confidence: number;
  costPenalty: number;
  latencyPenalty: number;
  uncertaintyPenalty: number;
  priceAnomaly: number;
}

export function computeMarketMakerScore(components: MarketScoreComponents): number {
  return weightedSum([
    { weight: 0.18, value: components.skillMatch },
    { weight: 0.15, value: components.bayesianMean },
    { weight: 0.14, value: components.ucbScore },
    { weight: 0.12, value: components.bidUtility },
    { weight: 0.10, value: components.elo },
    { weight: 0.07, value: components.graphTrust },
    { weight: 0.06, value: components.collaboration },
    { weight: 0.05, value: components.confidence },
    { weight: 0.05, value: components.priceAnomaly },
    { weight: -0.05, value: components.costPenalty },
    { weight: -0.04, value: components.latencyPenalty },
    { weight: -0.09, value: components.uncertaintyPenalty },
  ]);
}
