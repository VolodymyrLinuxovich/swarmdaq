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
  provider?: "gemini" | "openai" | "anthropic";
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

export interface MarketDecisionEntry {
  taskType: string;
  winnerId: string;
  winnerName: string;
  candidates: Array<{
    agentId: string;
    agentName: string;
    compositeScore: number;
    skillMatch: number;
    bayesianMean: number;
    ucb: number;
    graphTrust: number;
  }>;
}

export interface RunCost {
  inputTokens: number;
  outputTokens: number;
  totalUSD: number;
  model: string;
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
  runCost?: RunCost;
  weaveTraceUrl?: string;
  marketDecisionLog?: MarketDecisionEntry[];
  deliberationLog?: { entries: DeliberationEntry[]; revisions: DeliberationRevision[] };
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

export interface DeliberationEntry {
  kind: "objection" | "endorsement";
  criticId: string;
  criticName: string;
  targetAgentId: string;
  targetAgentName: string;
  taskType: string;
  claim: string;
  severity?: "critical" | "minor";
}

export interface DeliberationRevision {
  agentId: string;
  agentName: string;
  taskType: string;
  summary: string;
}

export type StreamEvent =
  | { type: "phase"; phase: string }
  | { type: "tasks"; tasks: Task[] }
  | { type: "bid"; taskType: string; winnerName: string; bids: AgentBid[]; decisionEntry: MarketDecisionEntry }
  | { type: "swarm"; agents: Agent[] }
  | { type: "agent_start"; agentId: string; agentName: string; taskType: string }
  | { type: "agent_done"; agentId: string; agentName: string; taskType: string; output: string }
  | { type: "deliberation_start" }
  | { type: "deliberation_entry"; entry: DeliberationEntry }
  | { type: "deliberation_revision"; revision: DeliberationRevision }
  | { type: "deliberation_done"; objections: number; endorsements: number; revisions: number }
  | { type: "score"; evalScore: EvalScore }
  | { type: "rep_change"; change: ReputationChange }
  | { type: "done"; result: MissionResult }
  | { type: "error"; message: string };
