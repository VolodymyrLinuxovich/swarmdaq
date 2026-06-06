"use client";

import { motion } from "framer-motion";
import Link from "next/link";

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-green-900/40" />
      <span className="text-xs font-mono text-green-500/70 uppercase tracking-widest px-3">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-green-900/40" />
    </div>
  );
}

const SECTIONS = [
  {
    step: "01",
    title: "Mission Decomposition",
    color: "#00aaff",
    icon: "🧠",
    body: "The user submits a free-form mission. PlannerAgent decomposes it into a structured task graph: market_research → positioning → landing_page_copy → pitch_script → risk_review → final_eval. Each task carries required skills that agents will bid against.",
    code: `PlannerAgent.decompose(mission)
→ tasks: [
  { id: "market_research", skills: ["research", "market_analysis"] },
  { id: "positioning",     skills: ["positioning", "synthesis"] },
  { id: "pitch_script",    skills: ["pitch", "narrative"] },
  { id: "risk_review",     skills: ["risk_analysis", "red_teaming"] },
  { id: "final_eval",      skills: ["evaluation"] }
]`,
  },
  {
    step: "02",
    title: "Agent Auction",
    color: "#a855f7",
    icon: "⚖️",
    body: "Each task triggers an open auction. All eligible agents submit bids with claimed confidence, cost, latency, and expected quality. MarketMaker runs a Vickrey-inspired mechanism: the highest utility bid wins, but pays the clearing price of the second-best bid. This approximates a truthful-style allocation mechanism for the demo.",
    code: `utilityBid =
  0.40 * expectedQuality +
  0.25 * confidence +
  0.20 * trustScore -
  0.10 * normalizedCost -
  0.05 * normalizedLatency -
  0.10 * risk

winner = argmax(utilityBid)
clearingPrice = secondBest.cost`,
  },
  {
    step: "03",
    title: "Market-Maker Routing",
    color: "#fbbf24",
    icon: "📡",
    body: "MarketMaker combines seven signals into a final agent score: skill match, Bayesian trust, UCB1 exploration bonus, bid utility, normalized Elo, PageRank trust centrality, and collaboration history. The UCB1 term ensures under-tested agents get chances — preventing the system from collapsing to always the same agents.",
    code: `finalScore =
  0.20 * skillMatch +
  0.18 * bayesianMean +
  0.16 * ucb1Score +
  0.14 * utilityBid +
  0.12 * normalizedElo +
  0.08 * graphTrust +
  0.07 * collaboration +
  0.05 * confidence -
  0.05 * normalizedCost -
  0.05 * normalizedLatency -
  0.10 * uncertainty`,
  },
  {
    step: "04",
    title: "Weave Tracing",
    color: "#00ff88",
    icon: "🔍",
    body: "Every operation — mission receipt, task planning, bid collection, agent execution, evaluation, reputation update — is traced as a structured event. When WANDB_API_KEY is set, events flow to W&B Weave for full observability, experiment tracking, and eval replay. The trace store is always local as fallback.",
    code: `traceEvent({ type: "mission_received", data: { missionId, mission } })
traceEvent({ type: "collect_bid",      data: { taskId } })
traceEvent({ type: "run_agent",        data: { agentId, task } })
traceEvent({ type: "evaluate_output",  data: { runNum } })
traceEvent({ type: "update_reputation",data: { changes } })
traceEvent({ type: "final_synthesis",  data: { score } })

// W&B Weave SDK connects here:
// weave.init(WANDB_PROJECT)
// weave.logEvent(traceEvent)`,
  },
  {
    step: "05",
    title: "Redis Memory",
    color: "#dc382d",
    icon: "💾",
    body: "Agent state persists across runs. If REDIS_URL is set, the system uses Redis hashes (agent:{id}), sorted sets (agent:leaderboard), and string keys (memory:{taskType}:{agentId}). Without Redis, an in-memory store provides full functionality. The same API works for both.",
    code: `// Redis schema
HSET agent:research reputation 78 factuality 0.72 alpha 5 beta 4
ZADD agent:leaderboard 93 skeptic 91 source_verifier 90 evaluator
SET  memory:market_research:research {"score":0.74,"count":3}

// Memory API (same interface for Redis + in-memory)
getAgents()          → Agent[]
updateAgent(id, patch)
recordTaskMemory(task, agentId, score)
getLeaderboard()     → Agent[] (sorted by reputation)`,
  },
  {
    step: "06",
    title: "Evaluation Loop",
    color: "#00ff88",
    icon: "📊",
    body: "EvaluatorAgent scores each output on six dimensions: quality, factuality, usefulness, specificity, actionability, and collaboration. Bayesian Beta reputation updates immediately. Elo ratings shift based on relative agent performance. The evaluator catches hallucinations — like ResearchAgent's unsourced market-size claim on run 1.",
    code: `// Run 1 evaluation finding:
⚠️  ResearchAgent made an unsupported market-size claim.
    Future runs should pair ResearchAgent + SourceVerifierAgent.

// Bayesian update
α_new = α + r        // r = normalized eval score
β_new = β + (1 - r)
bayesianMean = α_new / (α_new + β_new)
uncertainty = √(αβ / ((α+β)² * (α+β+1)))

// Elo update
E[A] = 1 / (1 + 10^((Rb - Ra) / 400))
R_new = R_old + K * (actual - expected)  // K=24`,
  },
  {
    step: "07",
    title: "Self-Improvement",
    color: "#00aaff",
    icon: "🚀",
    body: "Run 1 exposes a factuality gap. ResearchAgent loses reputation. SourceVerifierAgent is recommended as a required pair. The trust graph records their collaboration edge. On run 2, UCB + Bayesian reputation + swarm portfolio optimization selects ResearchAgent + SourceVerifierAgent together. Score improves from 74 → 91. The market learned.",
    code: `// Run 1 → Run 2 comparison
Score:       74  →  91   (+17)
Factuality:  68  →  94   (+26)
Confidence:  —   →  +12%
Risk cover:  —   →  -23%

// Swarm portfolio objective
objective = E[return] - 0.35*variance - 0.15*cost + synergy
Run 1: 0.61   →   Run 2: 0.84  (+0.23)

// Shapley: who drove the gain?
SourceVerifierAgent: +17 factuality points
SkepticAgent: +9 risk-reduction points`,
  },
];

const MATH_MODELS = [
  { title: "UCB1 Bandit Routing", formula: "UCB = μ + 1.4·√(ln N / nᵢ)", color: "#00ff88", desc: "Exploration/exploitation balance" },
  { title: "Bayesian Beta Reputation", formula: "β(α,β) → E[trust] = α/(α+β)", color: "#00aaff", desc: "Shrinking uncertainty over time" },
  { title: "Vickrey Auction", formula: "winner = argmax(utility), price = 2nd", color: "#a855f7", desc: "Truth-telling bid mechanism" },
  { title: "Elo + Bradley-Terry", formula: "P(A>B) = exp(Ra)/(exp(Ra)+exp(Rb))", color: "#fbbf24", desc: "Pairwise agent duel ratings" },
  { title: "Markowitz Portfolio", formula: "max E[ret] - λ·var - μ·cost + syn", color: "#00ff88", desc: "Swarm quality/risk/cost tradeoff" },
  { title: "Shapley Contribution", formula: "φ(i) ≈ score(S) - score(S\\{i})", color: "#00aaff", desc: "Leave-one-out credit attribution" },
  { title: "PageRank Trust Graph", formula: "PR(i) = (1-d)/N + d·Σ(PR(j)/out(j))", color: "#a855f7", desc: "Collaboration hub centrality" },
];

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-black grid-bg font-mono">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-black/90 backdrop-blur-sm border-b border-green-900/20">
        <Link href="/" className="text-sm font-black neon-green tracking-widest">SWARMDAQ</Link>
        <div className="flex items-center gap-4">
          <Link href="/demo" className="text-xs text-slate-500 hover:text-green-400 transition-colors">Demo</Link>
          <Link href="/demo" className="px-4 py-2 text-xs font-bold border border-green-500/50 text-green-400 rounded hover:bg-green-500/10 transition-all">
            Launch Demo →
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-green-900/60 bg-green-950/20 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-green-400">System Architecture</span>
          </div>
          <h1 className="text-5xl font-black text-slate-100 mb-4">
            How SwarmDAQ Works
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            A quantitative agent exchange built on auction theory, bandit learning, and Bayesian reputation.
          </p>
        </motion.div>

        {/* Architecture flow diagram */}
        <div className="terminal-card p-6 mb-16">
          <div className="text-xs text-slate-600 uppercase tracking-wider mb-4">System Flow</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {[
              { label: "User Mission", color: "#fbbf24" },
              { label: "PlannerAgent", color: "#00aaff" },
              { label: "Task Graph", color: "#00aaff" },
              { label: "Agent Auction", color: "#a855f7" },
              { label: "MarketMaker", color: "#a855f7" },
              { label: "Selected Swarm", color: "#00ff88" },
              { label: "Gemini Execution", color: "#00ff88" },
              { label: "W&B Weave Traces", color: "#fbbf24" },
              { label: "Evaluator", color: "#00ff88" },
              { label: "Redis Memory", color: "#dc382d" },
            ].map((node, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded border"
                  style={{ borderColor: `${node.color}50`, color: node.color, backgroundColor: `${node.color}08` }}
                >
                  {node.label}
                </div>
                {i < arr.length - 1 && <span className="text-slate-700">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed sections */}
        <div className="space-y-16">
          {SECTIONS.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              viewport={{ once: true }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start"
            >
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{section.icon}</span>
                  <span className="text-2xl font-black" style={{ color: section.color }}>
                    {section.step}
                  </span>
                  <h2 className="text-xl font-bold text-slate-100">{section.title}</h2>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{section.body}</p>
              </div>
              <div
                className="p-4 rounded border text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto"
                style={{
                  borderColor: `${section.color}30`,
                  backgroundColor: `${section.color}05`,
                  color: section.color,
                }}
              >
                {section.code}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Math models */}
        <div className="mt-24">
          <SectionLabel label="Mathematical Engine" />
          <p className="text-center text-slate-500 text-sm mb-10">
            SwarmDAQ is not just prompt chaining. Every routing decision is grounded in math.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MATH_MODELS.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                viewport={{ once: true }}
                className="p-4 rounded border bg-black/60"
                style={{ borderColor: `${m.color}33` }}
              >
                <h3 className="text-xs font-bold mb-2" style={{ color: m.color }}>{m.title}</h3>
                <div
                  className="text-xs font-mono p-2 rounded mb-2"
                  style={{ backgroundColor: `${m.color}08`, color: m.color, borderLeft: `2px solid ${m.color}` }}
                >
                  {m.formula}
                </div>
                <p className="text-xs text-slate-600">{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Self-improvement callout */}
        <div className="mt-20 p-8 rounded border border-green-900/40 bg-green-950/10 text-center">
          <div className="text-xs font-mono text-green-500/70 mb-3 uppercase tracking-widest">The Key Insight</div>
          <h2 className="text-3xl font-black text-slate-100 mb-4">
            The second run is always better.
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto leading-relaxed mb-6">
            After run 1, ResearchAgent is penalized for an unsupported claim. SourceVerifierAgent is recommended as a required pair. The trust graph records their collaboration edge. On run 2, the market selects a better swarm automatically.
          </p>
          <div className="flex justify-center gap-12 font-mono text-sm">
            <div className="text-center">
              <div className="text-3xl font-black text-amber-400">74</div>
              <div className="text-xs text-slate-600">Run 1 Score</div>
            </div>
            <div className="text-center text-slate-700 text-2xl font-black self-center">→</div>
            <div className="text-center">
              <div className="text-3xl font-black text-green-400">91</div>
              <div className="text-xs text-slate-600">Run 2 Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-black neon-green">+17</div>
              <div className="text-xs text-slate-600">Factuality Points</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-10 py-5 bg-green-500 text-black font-black text-sm rounded hover:bg-green-400 transition-all glow-green tracking-wider"
          >
            ⚡ SEE IT IN ACTION →
          </Link>
        </div>
      </div>
    </div>
  );
}
