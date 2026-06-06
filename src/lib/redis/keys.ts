export const KEY = {
  // Legacy-compatible app state
  runCount: "swarmdaq:runCount",
  lastMission: "swarmdaq:lastMission",
  agent: (id: string) => `swarmdaq:agent:${id}`,
  agentHistory: (id: string) => `swarmdaq:agent:${id}:history`,
  taskMem: (type: string, id: string) => `swarmdaq:mem:${type}:${id}`,
  missionsIndex: "swarmdaq:missions:index",
  mission: (id: string) => `swarmdaq:mission:${id}`,
  missionEvents: (id: string) => `swarmdaq:events:${id}`,
  marketFeed: "swarmdaq:market:feed",
  customAgentsList: "swarmdaq:custom_agents",

  // Requested Redis market schema
  agentLeaderboardReputation: "swarmdaq:agent:leaderboard:reputation",
  agentLeaderboardElo: "swarmdaq:agent:leaderboard:elo",
  agentLeaderboardFactuality: "swarmdaq:agent:leaderboard:factuality",
  agentLeaderboardMarketValue: "swarmdaq:agent:leaderboard:market-value",
  agentLeaderboardBayesian: "swarmdaq:agent:leaderboard:bayesian",
  agentLeaderboardUncertainty: "swarmdaq:agent:leaderboard:uncertainty",
  run: (runId: string) => `swarmdaq:run:${runId}`,
  streamMarketEvents: "swarmdaq:stream:market-events",
  streamEvaluations: "swarmdaq:stream:evaluations",
  tdigestPriceGlobal: "swarmdaq:tdigest:price:global",
  tdigestPriceTask: (taskType: string) => `swarmdaq:tdigest:price:task:${taskType}`,
  tdigestBidPriceTask: (taskType: string) => `swarmdaq:tdigest:bid-price:task:${taskType}`,
  tdigestLatencyGlobal: "swarmdaq:tdigest:latency:global",
  tdigestScoreDeltaGlobal: "swarmdaq:tdigest:score-delta:global",
  tdigestCostQualityGlobal: "swarmdaq:tdigest:cost-quality:global",
  anomaly: (runId: string) => `swarmdaq:anomaly:${runId}`,
  anomaliesIndex: "swarmdaq:anomalies:index",
  tdigestProbe: "swarmdaq:tdigest:probe",
  tdigestFallbackSamples: (key: string) => `swarmdaq:tdigest:fallback:${encodeURIComponent(key)}`,

  // Backward-compatible aliases consumed by older UI/Copilot code
  get lbReputation() { return this.agentLeaderboardReputation; },
  get lbBayesian() { return this.agentLeaderboardBayesian; },
  get lbElo() { return this.agentLeaderboardElo; },
  get lbUncertainty() { return this.agentLeaderboardUncertainty; },
  get tdScoreOverall() { return "swarmdaq:tdigest:score:overall"; },
  tdScoreDimension: (dim: string) => `swarmdaq:tdigest:score:${dim}`,
  tdAgentScore: (agentId: string) => `swarmdaq:tdigest:agent:${agentId}:score`,
  tdAgentDelta: (agentId: string) => `swarmdaq:tdigest:agent:${agentId}:delta`,
  get tdLatencyGlobal() { return "swarmdaq:tdigest:latency:global"; },
  tdLatencyModel: (model: string) => `swarmdaq:tdigest:latency:model:${model}`,
} as const;

export type RedisKey = (typeof KEY)[keyof typeof KEY];
