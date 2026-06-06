export type AgentStatus =
  | "idle"
  | "bidding"
  | "selected"
  | "running"
  | "done"
  | "promoted"
  | "penalized";

export interface Agent {
  id: string;
  name: string;
  role: string;
  skills: string[];
  price: number;
  reputation: number;
  factuality: number;
  usefulness: number;
  collaboration: number;
  latencyAvg: number;
  status: AgentStatus;
  // Math engine fields
  alpha: number;
  beta: number;
  meanReward: number;
  uncertainty: number;
  runs: number;
  wins: number;
  losses: number;
  elo: number;
  ucbScore: number;
  graphTrust: number;
  bayesianMean: number;
}

export interface AgentBid {
  agentId: string;
  taskId: string;
  confidence: number;
  cost: number;
  latency: number;
  expectedQuality: number;
  risk: number;
  utilityBid: number;
  reason: string;
  clearingPrice?: number;
  isWinner?: boolean;
}

export interface Task {
  id: string;
  type: string;
  description: string;
  requiredSkills: string[];
  assignedAgentId?: string;
  status: "pending" | "bidding" | "assigned" | "running" | "done";
  output?: string;
  score?: number;
}

export interface EvalScore {
  quality: number;
  factuality: number;
  usefulness: number;
  specificity: number;
  actionability: number;
  collaboration: number;
  overall: number;
}

export interface ReputationChange {
  agentId: string;
  agentName: string;
  delta: number;
  reason: string;
  eloDelta: number;
  alphaDelta: number;
  betaDelta: number;
}

export interface SwarmPortfolio {
  agentIds: string[];
  expectedReturn: number;
  variance: number;
  totalCost: number;
  synergyBonus: number;
  objective: number;
}

export interface ShapleyContribution {
  agentId: string;
  agentName: string;
  contribution: number;
  dimension: string;
}

export interface TraceEvent {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  duration?: number;
}

export interface LLMTrace {
  model: string;
  agentId: string;
  task: string;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  output: string;
}

export interface EvalTrace {
  missionId: string;
  scores: EvalScore;
  agentContributions: ShapleyContribution[];
}

export interface AgentMessage {
  fromId: string;
  toId: string;
  message: string;
  type: "info" | "flag" | "confirm" | "synergy" | "penalty";
}

export interface MissionResult {
  missionId: string;
  mission: string;
  tasks: Task[];
  selectedAgents: Agent[];
  bids: AgentBid[];
  output: {
    positioning: string;
    landingHeadline: string;
    risks: string[];
    pitch: string;
    swarmComposition: string[];
  };
  evalScore: EvalScore;
  reputationChanges: ReputationChange[];
  traces: TraceEvent[];
  swarmPortfolio: SwarmPortfolio;
  shapleyContributions: ShapleyContribution[];
  mathSnapshot: MathSnapshot;
  runNumber: number;
  improvementFromPrevious?: ImprovementSummary;
  agentMessages?: AgentMessage[];
}

export interface ImprovementSummary {
  factualityDelta: number;
  confidenceDelta: number;
  riskDelta: number;
  costDelta: number;
  swarmObjectiveDelta: number;
  previousScore: number;
  currentScore: number;
  message: string;
}

export interface MathSnapshot {
  ucbScores: Record<string, number>;
  bayesianMeans: Record<string, number>;
  uncertainties: Record<string, number>;
  eloRatings: Record<string, number>;
  graphTrust: Record<string, number>;
  swarmPortfolio: SwarmPortfolio;
  pairwiseProbabilities: Array<{ a: string; b: string; pABeatsB: number; dimension: string }>;
}
