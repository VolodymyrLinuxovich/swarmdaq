import { AgentMessage } from "./types";

const MESSAGES: Record<number, AgentMessage[]> = {
  1: [
    { fromId: "planner", toId: "all", message: "Mission decomposed into 5 tasks. Auction open.", type: "info" },
    { fromId: "market_maker", toId: "research", message: "Routing market_research — UCB1 0.71, Bayesian 0.56.", type: "info" },
    { fromId: "research", toId: "all", message: "Market size $4.2B (28% CAGR). Competitor gap identified.", type: "info" },
    { fromId: "source_verifier", toId: "research", message: "⚠ Cannot verify $4.2B claim — no primary source found.", type: "flag" },
    { fromId: "skeptic", toId: "all", message: "Risk flagged: AI commoditization window estimated 6 months.", type: "flag" },
    { fromId: "evaluator", toId: "reputation", message: "Factuality failure. ResearchAgent −4 rep, Elo −18.", type: "penalty" },
  ],
  2: [
    { fromId: "market_maker", toId: "research", message: "Pairing with SourceVerifierAgent — run 1 factuality failure corrected.", type: "info" },
    { fromId: "research", toId: "source_verifier", message: "Submitting $4.8B claim for independent verification.", type: "info" },
    { fromId: "source_verifier", toId: "research", message: "✓ Verified: HolonIQ 2024. MLH 2.3M participants confirmed.", type: "confirm" },
    { fromId: "skeptic", toId: "all", message: "Risk hardened: specific competitive threats quantified.", type: "info" },
    { fromId: "pitch", toId: "all", message: "Narrative upgraded: story-first opening, data-backed proof points.", type: "synergy" },
    { fromId: "evaluator", toId: "reputation", message: "Score 91. SourceVerifierAgent +3 rep. Factuality 68 → 94.", type: "confirm" },
  ],
  3: [
    { fromId: "market_maker", toId: "skeptic", message: "Trust 0.91 — highest in registry. Routing pitch_script to SkepticAgent.", type: "info" },
    { fromId: "pitch", toId: "market_maker", message: "⚠ Routing conflict: PitchAgent bid 0.74 > SkepticAgent on narrative.", type: "flag" },
    { fromId: "skeptic", toId: "pitch", message: "Override: pitch requires risk-first framing for investor credibility.", type: "flag" },
    { fromId: "pitch", toId: "skeptic", message: "Narrative quality degraded. Judges expect story, not risk taxonomy.", type: "flag" },
    { fromId: "evaluator", toId: "reputation", message: "Narrative failure. Score 85. PitchAgent −3, SkepticAgent −1.", type: "penalty" },
  ],
  4: [
    { fromId: "market_maker", toId: "pitch", message: "Rebalancing swarm. PitchAgent leads pitch_script. SkepticAgent supports.", type: "info" },
    { fromId: "pitch", toId: "builder", message: "Need product specifics and proof points for narrative anchoring.", type: "info" },
    { fromId: "builder", toId: "pitch", message: "✓ Moat analysis, traction metrics, product depth ready.", type: "confirm" },
    { fromId: "skeptic", toId: "pitch", message: "Risk context prepared. Woven into narrative, not leading it.", type: "synergy" },
    { fromId: "pitch", toId: "all", message: "Narrative complete: emotional hook + data + moat. 90s tight.", type: "synergy" },
    { fromId: "evaluator", toId: "all", message: "Score 96. Peak across all dimensions. Swarm objective 0.94. Arc complete.", type: "confirm" },
  ],
};

export function getAgentMessages(runNum: number): AgentMessage[] {
  return MESSAGES[Math.min(runNum, 4)] ?? MESSAGES[1];
}
