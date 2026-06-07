import { AgentMessage } from "./types";

const MESSAGES: Record<number, AgentMessage[]> = {
  1: [
    { fromId: "planner", toId: "all", message: "Mission decomposed into 5 tasks. Auction open.", type: "info" },
    { fromId: "market_maker", toId: "gemini", message: "Routing market_research → GeminiAgent. UCB1 0.68, Bayesian 0.67.", type: "info" },
    { fromId: "gemini", toId: "all", message: "Market size $4.2B (28% CAGR). Competitor gap identified.", type: "info" },
    { fromId: "claude", toId: "gemini", message: "⚠ Cannot verify $4.2B claim — no primary source found.", type: "flag" },
    { fromId: "claude", toId: "all", message: "Risk flagged: AI commoditization window estimated 6 months.", type: "flag" },
    { fromId: "evaluator", toId: "reputation", message: "Factuality failure. GeminiAgent −3 rep, Elo −12.", type: "penalty" },
  ],
  2: [
    { fromId: "market_maker", toId: "gemini", message: "Routing research to GeminiAgent — factuality methodology corrected.", type: "info" },
    { fromId: "gemini", toId: "claude", message: "Submitting $4.8B claim for independent verification.", type: "info" },
    { fromId: "claude", toId: "gemini", message: "✓ Verified: HolonIQ 2024. MLH 2.3M participants confirmed.", type: "confirm" },
    { fromId: "claude", toId: "all", message: "Risk hardened: specific competitive threats quantified.", type: "info" },
    { fromId: "claude", toId: "all", message: "Narrative upgraded: story-first opening, data-backed proof points.", type: "synergy" },
    { fromId: "evaluator", toId: "reputation", message: "Score 91. ClaudeAgent +3 rep. Factuality 68 → 94.", type: "confirm" },
  ],
  3: [
    { fromId: "market_maker", toId: "claude", message: "Trust 0.91 — highest in registry. Routing pitch_script to ClaudeAgent.", type: "info" },
    { fromId: "claude", toId: "market_maker", message: "⚠ Risk analysis framing bleeding into pitch narrative — over-rotation detected.", type: "flag" },
    { fromId: "claude", toId: "all", message: "Override: pitch requires risk-first framing for investor credibility.", type: "flag" },
    { fromId: "evaluator", toId: "reputation", message: "Narrative failure. Score 85. ClaudeAgent −2 rep (risk over-rotation).", type: "penalty" },
  ],
  4: [
    { fromId: "market_maker", toId: "claude", message: "Rebalancing swarm. ClaudeAgent leads pitch_script. CodexAgent supports product depth.", type: "info" },
    { fromId: "claude", toId: "codex", message: "Need product specifics and proof points for narrative anchoring.", type: "info" },
    { fromId: "codex", toId: "claude", message: "✓ Architecture, moat analysis, traction metrics ready.", type: "confirm" },
    { fromId: "claude", toId: "all", message: "Risk context woven into narrative, not leading it.", type: "synergy" },
    { fromId: "claude", toId: "all", message: "Narrative complete: emotional hook + data + moat. 90s tight.", type: "synergy" },
    { fromId: "evaluator", toId: "all", message: "Score 96. Peak across all dimensions. Swarm objective 0.94. Arc complete.", type: "confirm" },
  ],
};

export function getAgentMessages(runNum: number): AgentMessage[] {
  return MESSAGES[Math.min(runNum, 4)] ?? MESSAGES[1];
}
