"use client";

import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotPopup } from "@copilotkit/react-ui";
import type { MissionResult, Agent, MarketDecisionEntry } from "@/lib/types";
import type { TraceSummary } from "@/app/api/traces/route";
import { MissionResultCard } from "./copilot/MissionResultCard";
import { AgentBidCard } from "./copilot/AgentBidCard";
import { MarketMakerDecisionCard } from "./copilot/MarketMakerDecisionCard";
import { TraceTimelineCard } from "./copilot/TraceTimelineCard";
import { ReputationDeltaCard } from "./copilot/ReputationDeltaCard";
import { SwarmRebalanceCard, type RebalanceResult } from "./copilot/SwarmRebalanceCard";
import { WeakAgentCard, getAgentLabel } from "./copilot/WeakAgentCard";
import { MemoryCard } from "./copilot/MemoryCard";
import { MissionReplayCard } from "./copilot/MissionReplayCard";
import { RunComparisonCard } from "./copilot/RunComparisonCard";
import type { MarketMemorySummary, MissionEvent, AgentHistoryEntry } from "@/lib/marketHistory";

// ── Market scoring ────────────────────────────────────────────────────────────

function scoreAgent(agent: Agent, goal: string): number {
  const priceNorm = 1 - Math.min(agent.price / 0.1, 1);
  const latNorm = 1 - Math.min(agent.latencyAvg / 3, 1);
  switch (goal) {
    case "quality":
      return agent.bayesianMean * 0.45 + (agent.reputation / 100) * 0.3 + agent.graphTrust * 0.25;
    case "cost":
      return priceNorm * 0.55 + agent.bayesianMean * 0.3 + latNorm * 0.15;
    case "speed":
      return latNorm * 0.6 + agent.bayesianMean * 0.3 + priceNorm * 0.1;
    case "factuality":
      return agent.factuality * 0.5 + agent.bayesianMean * 0.3 + agent.graphTrust * 0.2;
    default: // balanced
      return agent.bayesianMean * 0.3 + (agent.reputation / 100) * 0.2 + agent.graphTrust * 0.2 +
        (1 - agent.uncertainty) * 0.15 + priceNorm * 0.15;
  }
}

const TASK_SKILL_MAP: Record<string, string[]> = {
  market_research:   ["research", "market_analysis"],
  positioning:       ["product_design", "positioning"],
  landing_page_copy: ["copywriting", "landing_page"],
  pitch_script:      ["pitch", "narrative"],
  risk_review:       ["risk_analysis", "critical_thinking"],
  final_eval:        ["evaluation", "scoring"],
};

function agentFitsSkills(agent: Agent, skills: string[]): boolean {
  return skills.some((s) => agent.skills.includes(s));
}

function computeRebalance(agents: Agent[], goal: string): RebalanceResult {
  const required = ["market_research", "positioning", "landing_page_copy", "pitch_script", "risk_review"];
  const recommended: RebalanceResult["recommended"] = [];
  const addedIds = new Set<string>();

  for (const taskType of required) {
    const skills = TASK_SKILL_MAP[taskType] ?? [];
    const eligible = agents.filter((a) => agentFitsSkills(a, skills));
    if (!eligible.length) continue;
    const scored = eligible.map((a) => ({ agent: a, score: scoreAgent(a, goal) }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!addedIds.has(best.agent.id)) {
      addedIds.add(best.agent.id);
      recommended.push({
        id: best.agent.id,
        name: best.agent.name,
        score: best.score,
        reason: `best ${goal} score for ${taskType.replace(/_/g, " ")}`,
      });
    }
  }

  const evalAgent = agents.find((a) => a.id === "evaluator");
  if (evalAgent && !addedIds.has("evaluator")) {
    addedIds.add("evaluator");
    recommended.push({ id: "evaluator", name: evalAgent.name, score: scoreAgent(evalAgent, goal), reason: "quality gate — always required" });
  }

  const allScored = agents.map((a) => ({ agent: a, score: scoreAgent(a, goal) })).sort((a, b) => b.score - a.score);
  const topIds = new Set(allScored.slice(0, 5).map((x) => x.agent.id));
  const removedIds = allScored.slice(5).map((x) => x.agent.id);

  const removed = removedIds
    .filter((id) => addedIds.has(id) || !topIds.has(id))
    .slice(0, 2)
    .map((id) => {
      const a = agents.find((x) => x.id === id)!;
      return { id, name: a.name, reason: `low ${goal} score (${scoreAgent(a, goal).toFixed(2)})` };
    });

  const added = allScored
    .filter((x) => !removedIds.includes(x.agent.id) && addedIds.has(x.agent.id))
    .slice(0, 1)
    .map(({ agent }) => ({ id: agent.id, name: agent.name, reason: `high ${goal} score (${scoreAgent(agent, goal).toFixed(2)})` }));

  const tradeoffMap: Record<string, string> = {
    quality:     "Higher Bayesian trust scores. May increase cost +15-20%. Uncertainty penalty applied to all candidates.",
    cost:        "Cheapest viable agents selected. Expected quality drop ~8-12 pts. Latency unaffected.",
    speed:       "Lowest latency agents prioritized. SourceVerifier may be excluded — factuality risk increases.",
    factuality:  "Factuality coefficient maximized. SkepticAgent and SourceVerifier take priority over narrative agents.",
    balanced:    "Markowitz-style portfolio: expected return maximized subject to variance and cost constraints.",
  };

  const avgBayes = recommended.reduce((s, r) => s + (agents.find((a) => a.id === r.id)?.bayesianMean ?? 0), 0) / recommended.length;
  const avgCost = recommended.reduce((s, r) => s + (agents.find((a) => a.id === r.id)?.price ?? 0), 0);

  return {
    goal,
    recommended,
    removed,
    added,
    tradeoffs: tradeoffMap[goal] ?? "Balanced optimization applied.",
    expectedQuality: Math.round(60 + avgBayes * 35),
    expectedCost: avgCost,
  };
}

function buildMarketMakerExplanation(log: MarketDecisionEntry[], agents: Agent[]): string {
  if (!log.length) return "No market decision log available. Run a mission first.";

  const lines: string[] = [];
  for (const entry of log.slice(0, 4)) {
    const winner = entry.candidates[0];
    const loser = entry.candidates[1];
    if (!winner) continue;
    const agent = agents.find((a) => a.id === winner.agentId);
    const winMargin = loser ? (winner.compositeScore - loser.compositeScore).toFixed(4) : "N/A";
    const dominant = Object.entries({ skillMatch: winner.skillMatch, bayesianMean: winner.bayesianMean, ucb: winner.ucb, graphTrust: winner.graphTrust })
      .sort(([, a], [, b]) => b - a)[0];
    lines.push(`${entry.taskType.replace(/_/g, " ")}: ${entry.winnerName} won (Δ +${winMargin}). Dominant factor: ${dominant?.[0]} = ${dominant?.[1].toFixed(3)}.`);
    if (loser) lines.push(`  Rejected: ${loser.agentName} (score ${loser.compositeScore.toFixed(4)}).`);
  }
  return lines.join("\n");
}

// ── Main component ─────────────────────────────────────────────────────────

export function SwarmCopilot() {

  // Global readable context
  useCopilotReadable({
    description: "SwarmDAQ system description",
    value: `SwarmDAQ is a live AI agent performance exchange. 9 agents (PlannerAgent, ResearchAgent, SourceVerifierAgent, BuilderAgent, PitchAgent, SkepticAgent, EvaluatorAgent, MarketMakerAgent, ReputationAgent) bid on tasks through Vickrey-inspired auctions. Selection uses UCB1 bandits, Bayesian Beta reputation, Elo ratings, graph trust (PageRank), and portfolio optimization (Markowitz). Every run traces to W&B Weave. Redis stores reputation memory. The market self-improves over 4 runs: 74 → 91 → 85 → 96.`,
  });

  // ── Action: runMission ──────────────────────────────────────────────────

  useCopilotAction({
    name: "runMission",
    description: "Run a new mission through the SwarmDAQ agent market. The swarm will bid on tasks, execute with Gemini/GPT-4o/Claude, evaluate results, and update agent reputation.",
    parameters: [
      { name: "mission", type: "string", description: "The business mission to run through the agent market (e.g. 'Build a GTM strategy for RocketRide').", required: true },
      { name: "runNumber", type: "number", description: "Optional run number (1-4). Each run number produces a different learning arc.", required: false },
    ],
    handler: async ({ mission, runNumber }: { mission: string; runNumber?: number }) => {
      const res = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission, runNumber }),
      });
      const result: MissionResult = await res.json();
      return result;
    },
    render: ({ status, result }: { status: string; result?: MissionResult }) => {
      if (status !== "complete" || !result) {
        return (
          <div style={{ background: "#050505", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
            <div style={{ color: "#00ff88", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#00ff88", animation: "pulse 1.5s infinite" }} />
              Agent market running...
            </div>
            <div style={{ color: "#334155", marginTop: 6 }}>Auction → Swarm → Evaluate → Reputation</div>
          </div>
        );
      }
      return <MissionResultCard result={result} />;
    },
  });

  // ── Action: inspectAgents ───────────────────────────────────────────────

  useCopilotAction({
    name: "inspectAgents",
    description: "Fetch live agent scores from the SwarmDAQ registry — reputation, Elo, Bayesian mean, uncertainty, specialization, cost, latency, and market labels (BUY/HOLD/SELL/WATCH).",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/agents");
      const { agents } = await res.json() as { agents: Agent[] };
      return agents;
    },
    render: ({ status, result }: { status: string; result?: Agent[] }) => {
      if (status !== "complete" || !result?.length) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Fetching agent registry...</div>;
      }
      const sorted = [...result].sort((a, b) => b.bayesianMean - a.bayesianMean);
      return (
        <div style={{ background: "#050505", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ color: "#00ff88", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            📊 Agent Registry — Live Scores
          </div>
          {sorted.map((a) => {
            const label = getAgentLabel(a);
            const labelColors = { BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff" };
            const lc = labelColors[label];
            return (
              <div key={a.id} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: "1px solid #0f172a", alignItems: "center" }}>
                <span style={{ flex: 1, color: "#e2e8f0" }}>{a.name}</span>
                <span style={{ color: "#475569", fontSize: 11 }}>μ {a.bayesianMean.toFixed(2)}</span>
                <span style={{ color: "#334155", fontSize: 11 }}>σ {a.uncertainty.toFixed(2)}</span>
                <span style={{ color: "#475569", fontSize: 11 }}>elo {a.elo}</span>
                <span style={{ color: lc, padding: "1px 8px", borderRadius: 3, border: `1px solid ${lc}40`, background: `${lc}10`, fontWeight: 700, fontSize: 10 }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      );
    },
  });

  // ── Action: getTraces ───────────────────────────────────────────────────

  useCopilotAction({
    name: "getTraces",
    description: "Fetch W&B Weave trace data for the latest SwarmDAQ missions. Shows LLM call timeline, token counts, and latency per agent.",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/traces");
      const traces: TraceSummary = await res.json();
      return traces;
    },
    render: ({ status, result }: { status: string; result?: TraceSummary }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Fetching W&B Weave traces...</div>;
      }
      if (!result.totalCalls) {
        return (
          <div style={{ background: "#050505", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12, color: "#475569" }}>
            No traces yet. Run a mission first to generate Weave trace data.
          </div>
        );
      }
      return <TraceTimelineCard traces={result} />;
    },
  });

  // ── Action: resetMarket ─────────────────────────────────────────────────

  useCopilotAction({
    name: "resetMarket",
    description: "Reset the SwarmDAQ demo — clears Redis reputation memory, resets agent scores to baseline, and starts the learning arc from scratch.",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/reset-demo", { method: "POST" });
      return await res.json();
    },
    render: ({ status, result }: { status: string; result?: { ok: boolean; message: string } }) => {
      if (status !== "complete") {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Resetting market state...</div>;
      }
      return (
        <div style={{ background: "#050505", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ color: "#ef4444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>⚡ Market Reset</div>
          <div style={{ color: "#475569" }}>{result?.message ?? "Demo reset to initial state."}</div>
          <div style={{ color: "#334155", marginTop: 6 }}>All agent reputation scores restored to baseline. Run a new mission to start the learning arc.</div>
        </div>
      );
    },
  });

  // ── Action: explainMarketMaker ──────────────────────────────────────────

  useCopilotAction({
    name: "explainMarketMaker",
    description: "Explain why each agent was selected (or rejected) in the last mission. Breaks down the composite score: UCB1, Bayesian reputation, Elo, graph trust, skill match, bid utility, cost, uncertainty.",
    parameters: [],
    handler: async () => {
      const agentsRes = await fetch("/api/agents");
      const { agents } = await agentsRes.json() as { agents: Agent[] };
      return { agents };
    },
    render: ({ status, result }: { status: string; result?: { agents: Agent[]; log?: MarketDecisionEntry[] } }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Analyzing market decisions...</div>;
      }
      const demoLog: MarketDecisionEntry[] = result.log ?? [];
      const explanation = buildMarketMakerExplanation(demoLog, result.agents);
      return <MarketMakerDecisionCard log={demoLog} explanation={explanation} />;
    },
  });

  // ── Action: rebalanceSwarm ──────────────────────────────────────────────

  useCopilotAction({
    name: "rebalanceSwarm",
    description: "Suggest an optimized swarm composition based on a performance goal. Returns recommended agents, removed agents, added agents, and the expected quality/cost tradeoff.",
    parameters: [
      {
        name: "goal",
        type: "string",
        description: "Optimization goal: 'quality', 'cost', 'speed', 'factuality', or 'balanced'.",
        required: true,
      },
    ],
    handler: async ({ goal }: { goal: string }) => {
      const res = await fetch("/api/agents");
      const { agents } = await res.json() as { agents: Agent[] };
      const result = computeRebalance(agents, goal);
      return result;
    },
    render: ({ status, result }: { status: string; result?: RebalanceResult }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Computing optimal swarm composition...</div>;
      }
      return <SwarmRebalanceCard result={result} />;
    },
  });

  // ── Action: simulateAgentRemoval ────────────────────────────────────────

  useCopilotAction({
    name: "simulateAgentRemoval",
    description: "Simulate removing a specific agent from the swarm and predict the quality, cost, and factuality impact. Recommends a replacement agent.",
    parameters: [
      {
        name: "agentId",
        type: "string",
        description: "The agent ID to simulate removing. Options: planner, research, source_verifier, builder, pitch, skeptic, evaluator, market_maker, reputation.",
        required: true,
      },
    ],
    handler: async ({ agentId }: { agentId: string }) => {
      const res = await fetch("/api/agents");
      const { agents } = await res.json() as { agents: Agent[] };
      const target = agents.find((a) => a.id === agentId);
      if (!target) return { error: `Agent '${agentId}' not found.` };

      const remaining = agents.filter((a) => a.id !== agentId);
      const qualityImpact = -parseFloat((target.bayesianMean * 15 + target.graphTrust * 8).toFixed(1));
      const factualityImpact = target.skills.includes("fact_checking") || target.skills.includes("source_verification")
        ? -18 : target.skills.includes("research") ? -9 : -3;
      const costSaving = target.price;

      // Find replacement with closest skill match
      const replacement = remaining
        .filter((a) => a.skills.some((s) => target.skills.includes(s)))
        .sort((a, b) => b.bayesianMean - a.bayesianMean)[0];

      return {
        agentId,
        agentName: target.name,
        qualityImpact,
        factualityImpact,
        costSaving,
        bayesianMean: target.bayesianMean,
        graphTrust: target.graphTrust,
        skills: target.skills,
        replacement: replacement ? { id: replacement.id, name: replacement.name, bayesianMean: replacement.bayesianMean } : null,
      };
    },
    render: ({ status, result }: { status: string; result?: Record<string, unknown> }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Simulating agent removal...</div>;
      }
      if (result.error) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", padding: 12 }}>{result.error as string}</div>;
      }
      const qualityImpact = result.qualityImpact as number;
      const factualityImpact = result.factualityImpact as number;
      const costSaving = result.costSaving as number;
      const replacement = result.replacement as { id: string; name: string; bayesianMean: number } | null;
      return (
        <div style={{ background: "#050505", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
          <div style={{ color: "#ef4444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
            🔬 Removal Simulation — {result.agentName as string}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
            {[
              { label: "quality Δ", val: `${qualityImpact > 0 ? "+" : ""}${qualityImpact.toFixed(1)} pts`, color: qualityImpact >= 0 ? "#00ff88" : "#ef4444" },
              { label: "factuality Δ", val: `${factualityImpact > 0 ? "+" : ""}${factualityImpact} pts`, color: factualityImpact >= 0 ? "#00ff88" : "#ef4444" },
              { label: "cost saving", val: `$${(costSaving * 1000).toFixed(1)}/k`, color: "#fbbf24" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ padding: "8px 6px", borderRadius: 4, background: "#0a0a0a", textAlign: "center" }}>
                <div style={{ color: "#334155", fontSize: 9, marginBottom: 4 }}>{label}</div>
                <div style={{ color, fontWeight: 700 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ color: "#475569", marginBottom: 6 }}>Skills lost: {(result.skills as string[]).join(", ")}</div>
          {replacement && (
            <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(0,255,136,0.15)", background: "rgba(0,255,136,0.05)", color: "#64748b" }}>
              Recommended replacement: <span style={{ color: "#00ff88", fontWeight: 700 }}>{replacement.name}</span> (μ = {replacement.bayesianMean.toFixed(2)})
            </div>
          )}
        </div>
      );
    },
  });

  // ── Reputation update action ─────────────────────────────────────────────

  useCopilotAction({
    name: "showReputationChanges",
    description: "Show reputation changes from the most recently completed mission run.",
    parameters: [
      { name: "runNumber", type: "number", description: "The run number (1-4) to show reputation changes for.", required: false },
    ],
    handler: async ({ runNumber }: { runNumber?: number }) => {
      const res = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: "reputation_check_only", runNumber: runNumber ?? 1 }),
      });
      const result: MissionResult = await res.json();
      return { changes: result.reputationChanges, runNumber: result.runNumber };
    },
    render: ({ status, result }: { status: string; result?: { changes: MissionResult["reputationChanges"]; runNumber: number } }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Loading reputation data...</div>;
      }
      return <ReputationDeltaCard changes={result.changes} runNumber={result.runNumber} />;
    },
  });

  // ── Weak agent action ────────────────────────────────────────────────────

  useCopilotAction({
    name: "findWeakAgent",
    description: "Identify the weakest agent in the current registry — the one with the lowest Bayesian mean, highest uncertainty, or most reputation penalties. Returns full market analysis with BUY/HOLD/SELL/WATCH labels.",
    parameters: [],
    handler: async () => {
      const res = await fetch("/api/agents");
      const { agents } = await res.json() as { agents: Agent[] };
      const weakest = [...agents].sort((a, b) => {
        const scoreA = a.bayesianMean * 0.5 + (a.reputation / 100) * 0.3 - a.uncertainty * 0.2;
        const scoreB = b.bayesianMean * 0.5 + (b.reputation / 100) * 0.3 - b.uncertainty * 0.2;
        return scoreA - scoreB;
      })[0];
      return { agents, weakest };
    },
    render: ({ status, result }: { status: string; result?: { agents: Agent[]; weakest: Agent } }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Scanning agent registry...</div>;
      }
      return <WeakAgentCard agents={result.agents} weakest={result.weakest} />;
    },
  });

  // ── Action: getMarketMemory ─────────────────────────────────────────────

  useCopilotAction({
    name: "getMarketMemory",
    description: "Show what the SwarmDAQ market remembers: total missions run, top agent, riskiest agent, recent market feed events, and agent leaderboard with BUY/HOLD/SELL/WATCH labels. Powered by Redis.",
    parameters: [],
    handler: async () => {
      const [agentsRes, histRes, feedRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/history?limit=1"),
        fetch("/api/market-feed?limit=8"),
      ]);
      const { agents } = await agentsRes.json() as { agents: Agent[] };
      const { total: totalMissions } = await histRes.json() as { total: number };
      const { events: recentEvents } = await feedRes.json() as { events: MarketMemorySummary["recentEvents"] };

      const sorted = [...agents].sort((a, b) => b.reputation - a.reputation);
      const topAgent = sorted[0] ? { id: sorted[0].id, name: sorted[0].name, reputation: sorted[0].reputation } : null;
      const riskiest = [...agents].sort((a, b) => b.uncertainty - a.uncertainty)[0];
      const riskiestAgent = riskiest ? { id: riskiest.id, name: riskiest.name, uncertainty: riskiest.uncertainty } : null;
      const labelColors: Record<string, string> = { BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff" };
      const leaderboard = sorted.map((a) => {
        const label = getAgentLabel(a);
        return { id: a.id, name: a.name, score: a.reputation, label, color: labelColors[label] };
      });

      const summary: MarketMemorySummary = {
        mode: "redis",
        totalMissions,
        lastMissionId: null,
        topAgent,
        riskiestAgent,
        recentEvents,
        leaderboard,
      };
      return summary;
    },
    render: ({ status, result }: { status: string; result?: MarketMemorySummary }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Reading market memory...</div>;
      }
      return <MemoryCard summary={result} />;
    },
  });

  // ── Action: replayMission ───────────────────────────────────────────────

  useCopilotAction({
    name: "replayMission",
    description: "Replay the event timeline for a specific mission by run number. Shows every agent action, reputation update, and score in chronological order.",
    parameters: [
      { name: "runNumber", type: "number", description: "The run number to replay (e.g. 1, 2, 3, 4).", required: true },
    ],
    handler: async ({ runNumber }: { runNumber: number }) => {
      const histRes = await fetch(`/api/history?limit=20`);
      const { missions } = await histRes.json() as { missions: Array<{ missionId: string; runNumber: number }> };
      const match = missions.find((m) => m.runNumber === runNumber);
      if (!match) return { error: `No mission found for run #${runNumber}. Run the mission first.` };

      const detailRes = await fetch(`/api/history/${match.missionId}`);
      const { mission, events } = await detailRes.json() as { mission: MissionResult; events: MissionEvent[] };
      return { mission, events };
    },
    render: ({ status, result }: { status: string; result?: { mission: MissionResult; events: MissionEvent[]; error?: string } }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Loading mission replay...</div>;
      }
      if (result.error) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", padding: 12 }}>{result.error}</div>;
      }
      return <MissionReplayCard mission={result.mission} events={result.events} />;
    },
  });

  // ── Action: compareRuns ─────────────────────────────────────────────────

  useCopilotAction({
    name: "compareRuns",
    description: "Compare two mission runs side-by-side: score deltas, swarm changes, factuality drift, cost delta, and swarm objective improvement.",
    parameters: [
      { name: "runA", type: "number", description: "First run number to compare.", required: true },
      { name: "runB", type: "number", description: "Second run number to compare.", required: true },
    ],
    handler: async ({ runA, runB }: { runA: number; runB: number }) => {
      const histRes = await fetch(`/api/history?limit=20`);
      const { missions } = await histRes.json() as { missions: Array<{ missionId: string; runNumber: number }> };
      const mA = missions.find((m) => m.runNumber === runA);
      const mB = missions.find((m) => m.runNumber === runB);
      if (!mA || !mB) return { error: `Could not find runs #${runA} and #${runB}. Make sure both have been executed.` };

      const [dA, dB] = await Promise.all([
        fetch(`/api/history/${mA.missionId}`).then((r) => r.json()) as Promise<{ mission: MissionResult }>,
        fetch(`/api/history/${mB.missionId}`).then((r) => r.json()) as Promise<{ mission: MissionResult }>,
      ]);

      const rA = dA.mission;
      const rB = dB.mission;
      const delta = {
        overall:        rB.evalScore.overall       - rA.evalScore.overall,
        quality:        rB.evalScore.quality        - rA.evalScore.quality,
        factuality:     rB.evalScore.factuality     - rA.evalScore.factuality,
        usefulness:     rB.evalScore.usefulness     - rA.evalScore.usefulness,
        actionability:  rB.evalScore.actionability  - rA.evalScore.actionability,
        cost:           (rB.runCost?.totalUSD ?? 0) - (rA.runCost?.totalUSD ?? 0),
        swarmObjective: rB.swarmPortfolio.objective - rA.swarmPortfolio.objective,
      };

      const swarmChanged = rB.selectedAgents.map((a) => a.id).sort().join(",") !== rA.selectedAgents.map((a) => a.id).sort().join(",");
      const explanation = [
        `Run ${runA} scored ${rA.evalScore.overall}, run ${runB} scored ${rB.evalScore.overall} (${delta.overall > 0 ? "+" : ""}${delta.overall} pts).`,
        swarmChanged ? `Swarm changed: ${rA.selectedAgents.map((a) => a.name).join(", ")} → ${rB.selectedAgents.map((a) => a.name).join(", ")}.` : "Same swarm composition.",
        rB.improvementFromPrevious?.message ?? "",
      ].filter(Boolean).join(" ");

      return { runAResult: rA, runBResult: rB, delta, explanation };
    },
    render: ({ status, result }: { status: string; result?: { runAResult: MissionResult; runBResult: MissionResult; delta: { overall: number; quality: number; factuality: number; usefulness: number; actionability: number; cost: number; swarmObjective: number }; explanation: string; error?: string } }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Comparing runs...</div>;
      }
      if (result.error) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", padding: 12 }}>{result.error}</div>;
      }
      return <RunComparisonCard runAResult={result.runAResult} runBResult={result.runBResult} delta={result.delta} explanation={result.explanation} />;
    },
  });

  // ── Action: getAgentHistory ─────────────────────────────────────────────

  useCopilotAction({
    name: "getAgentHistory",
    description: "Show an agent's performance history across all mission runs — score per run, reputation delta, and trend.",
    parameters: [
      { name: "agentId", type: "string", description: "Agent ID: planner, research, source_verifier, builder, pitch, skeptic, evaluator, market_maker, or reputation.", required: true },
    ],
    handler: async ({ agentId }: { agentId: string }) => {
      const [agentsRes, historyRes] = await Promise.all([
        fetch("/api/agents"),
        fetch(`/api/leaderboard`),
      ]);
      const { agents } = await agentsRes.json() as { agents: Agent[] };
      const { leaderboard } = await historyRes.json() as { leaderboard: Array<{ id: string; name: string; reputation: number; bayesianMean: number; elo: number; label: string; runs: number; wins: number; losses: number }> };
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return { error: `Agent '${agentId}' not found.` };
      const lb = leaderboard.find((l) => l.id === agentId);
      return { agent, leaderboardEntry: lb, history: [] as AgentHistoryEntry[] };
    },
    render: ({ status, result }: { status: string; result?: { agent: Agent; leaderboardEntry: { reputation: number; bayesianMean: number; elo: number; label: string; runs: number; wins: number; losses: number } | undefined; history: AgentHistoryEntry[]; error?: string } }) => {
      if (status !== "complete" || !result) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Loading agent history...</div>;
      }
      if (result.error) {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#ef4444", padding: 12 }}>{result.error}</div>;
      }
      const { agent, leaderboardEntry, history } = result;
      const label = getAgentLabel(agent);
      const labelColors: Record<string, string> = { BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff" };
      return (
        <div style={{ background: "#050505", border: "1px solid rgba(0,170,255,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12, color: "#e0e0e0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ color: "#00aaff", fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
            <span style={{ background: labelColors[label], color: "#000", padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{label}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
            {[
              { label: "REPUTATION", val: agent.reputation, color: "#00ff88" },
              { label: "BAYESIAN μ", val: agent.bayesianMean.toFixed(3), color: "#00aaff" },
              { label: "ELO", val: agent.elo, color: "#fbbf24" },
              { label: "RUNS", val: leaderboardEntry?.runs ?? agent.runs, color: "#888" },
            ].map(({ label: l, val, color }) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 4, padding: "6px", textAlign: "center" }}>
                <div style={{ color: "#555", fontSize: 9 }}>{l}</div>
                <div style={{ color, fontWeight: 700, fontSize: 14 }}>{String(val)}</div>
              </div>
            ))}
          </div>
          <div style={{ color: "#555", marginBottom: 6, fontSize: 11 }}>
            W/L: {leaderboardEntry?.wins ?? 0} / {leaderboardEntry?.losses ?? 0} · uncertainty {(agent.uncertainty * 100).toFixed(1)}%
          </div>
          <div style={{ color: "#444", fontSize: 10, marginTop: 8 }}>
            Skills: {agent.skills.join(", ")}
          </div>
          {history.length > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 10, marginTop: 12, marginBottom: 6, letterSpacing: 1 }}>PERFORMANCE HISTORY</div>
              {history.map((h, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: "#555" }}>Run #{h.runNumber}</span>
                  <span style={{ color: "#ccc", flex: 1 }}>score {h.score}</span>
                  <span style={{ color: h.delta > 0 ? "#00ff88" : h.delta < 0 ? "#ef4444" : "#888", fontWeight: 700 }}>
                    {h.delta > 0 ? "+" : ""}{h.delta} rep
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      );
    },
  });

  // ── Action: explainRedisMemory ──────────────────────────────────────────

  useCopilotAction({
    name: "explainRedisMemory",
    description: "Explain the Redis market memory architecture: which data structures are used, what keys exist, TTLs, and how the memory layer improves agent selection over time.",
    parameters: [],
    handler: async () => {
      const feedRes = await fetch("/api/market-feed?limit=3");
      const { events, total } = await feedRes.json() as { events: MarketMemorySummary["recentEvents"]; total: number };
      return { events, total };
    },
    render: ({ status, result }: { status: string; result?: { events: MarketMemorySummary["recentEvents"]; total: number } }) => {
      if (status !== "complete") {
        return <div style={{ fontFamily: "monospace", fontSize: 12, color: "#334155", padding: 12 }}>Loading Redis schema...</div>;
      }
      const schema = [
        { key: "swarmdaq:missions:index",   type: "SORTED SET",  desc: "Mission IDs scored by timestamp. Keeps 50 most recent." },
        { key: "swarmdaq:mission:{id}",      type: "STRING",      desc: "Full MissionResult JSON. TTL: 7 days." },
        { key: "swarmdaq:events:{id}",       type: "LIST",        desc: "Append-only event log per mission. Reverse-chron." },
        { key: "swarmdaq:market:feed",       type: "LIST",        desc: "Rolling market ticker. Capped at 100 events." },
        { key: "swarmdaq:agent:{id}",        type: "STRING",      desc: "Live agent state: reputation, Bayesian α/β, Elo, UCB." },
        { key: "swarmdaq:agent:{id}:history",type: "LIST",        desc: "Per-agent score history. Last 20 runs." },
        { key: "swarmdaq:lb:reputation",     type: "SORTED SET",  desc: "Reputation leaderboard." },
        { key: "swarmdaq:lb:bayesian",       type: "SORTED SET",  desc: "Bayesian mean × 1000 leaderboard." },
        { key: "swarmdaq:lb:elo",            type: "SORTED SET",  desc: "Elo rating leaderboard." },
        { key: "swarmdaq:lb:uncertainty",    type: "SORTED SET",  desc: "(1-σ)×100: low uncertainty = high score." },
        { key: "swarmdaq:mem:{type}:{id}",   type: "STRING",      desc: "Task-agent memory: EWMA score × count. TTL 7d." },
      ];
      return (
        <div style={{ background: "#050505", border: "1px solid rgba(0,170,255,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 11, color: "#e0e0e0" }}>
          <div style={{ color: "#00aaff", fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: 1 }}>REDIS MARKET MEMORY SCHEMA</div>
          <div style={{ color: "#888", marginBottom: 12 }}>
            Upstash Redis (HTTP REST, serverless-safe). Market feed: {result?.total ?? 0} recent events.
          </div>
          {schema.map((s) => (
            <div key={s.key} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: "#00aaff", fontSize: 10 }}>{s.key}</span>
                <span style={{ color: "#fbbf24", fontSize: 9, padding: "1px 4px", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 2 }}>{s.type}</span>
              </div>
              <div style={{ color: "#555", fontSize: 10, marginTop: 2 }}>{s.desc}</div>
            </div>
          ))}
          {result?.events && result.events.length > 0 && (
            <>
              <div style={{ color: "#888", fontSize: 10, marginTop: 8, marginBottom: 6, letterSpacing: 1 }}>LIVE FEED SAMPLE</div>
              {result.events.map((ev, i) => (
                <div key={i} style={{ color: ev.color, fontSize: 10, marginBottom: 2 }}>{ev.text}</div>
              ))}
            </>
          )}
        </div>
      );
    },
  });

  // ── Render popup ─────────────────────────────────────────────────────────

  return (
    <CopilotPopup
      labels={{
        title: "Ask SwarmDAQ",
        initial: "Command the agent market. Run missions, inspect bids, rebalance swarms, replay traces, and expose weak agents.\n\nTry: \"Run a mission for RocketRide\" or \"Which agent is overvalued?\"",
        placeholder: "Run a mission, inspect agents, rebalance swarm...",
      }}
    />
  );
}
