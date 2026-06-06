"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useCopilotReadable } from "@copilotkit/react-core";
import { getAgentLabel } from "@/components/copilot/WeakAgentCard";
import type { Agent } from "@/lib/types";

const AGENTS = [
  { name: "SkepticAgent", rep: 93, delta: "+2", color: "#00ff88" },
  { name: "SourceVerifier", rep: 91, delta: "+3", color: "#00aaff" },
  { name: "MarketMaker", rep: 92, delta: "+1", color: "#a855f7" },
  { name: "EvaluatorAgent", rep: 90, delta: "+2", color: "#00ff88" },
  { name: "PlannerAgent", rep: 88, delta: "+0", color: "#64748b" },
  { name: "ReputationAgent", rep: 89, delta: "+1", color: "#00ff88" },
  { name: "PitchAgent", rep: 86, delta: "+1", color: "#fbbf24" },
  { name: "BuilderAgent", rep: 80, delta: "+0", color: "#64748b" },
  { name: "ResearchAgent", rep: 78, delta: "-4", color: "#ef4444" },
];

const TICKER_ITEMS_STATIC = [
  { text: "SkepticAgent", delta: "▲ +2", color: "#00ff88", label: "BUY" },
  { text: "SourceVerifier", delta: "▲ +3", color: "#00ff88", label: "BUY" },
  { text: "ResearchAgent", delta: "▼ -4", color: "#ef4444", label: "SELL" },
  { text: "EvaluatorAgent", delta: "▲ +2", color: "#00ff88", label: "BUY" },
  { text: "PitchAgent", delta: "▲ +1", color: "#fbbf24", label: "HOLD" },
  { text: "MarketMaker", delta: "▲ +1", color: "#00ff88", label: "BUY" },
  { text: "BuilderAgent", delta: "─ +0", color: "#64748b", label: "HOLD" },
  { text: "PlannerAgent", delta: "─ +0", color: "#64748b", label: "HOLD" },
  { text: "ReputationAgent", delta: "▲ +1", color: "#00ff88", label: "BUY" },
];

const FLOW_STEPS = [
  { label: "Mission", icon: "⚡" },
  { label: "Planning", icon: "🧠" },
  { label: "Auction", icon: "⚖️" },
  { label: "Swarm", icon: "🐝" },
  { label: "Weave Trace", icon: "🔍" },
  { label: "Evaluation", icon: "📊" },
  { label: "Reputation", icon: "⭐" },
];

function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(target);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    setCount(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress === 1) {
        setCount(target);
        clearInterval(timer);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return <span ref={ref}>{count}</span>;
}

function Ticker({ liveAgents }: { liveAgents?: Agent[] }) {
  const labelColors: Record<string, string> = { BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff" };
  const source = liveAgents?.length
    ? liveAgents.map((a) => {
        const label = getAgentLabel(a);
        return {
          text: a.name.replace("Agent", ""),
          delta: "─ live",
          color: labelColors[label] ?? "#475569",
          label,
        };
      })
    : TICKER_ITEMS_STATIC;
  const items = [...source, ...source];
  return (
    <div className="overflow-hidden border-t border-b border-green-900/40 py-2 bg-black/60">
      <div className="ticker-inner gap-0">
        {items.map((item, i) => (
          <span key={i} className="whitespace-nowrap text-xs font-mono px-4 flex items-center gap-1.5">
            <span className="text-slate-400">{item.text}</span>
            <span className="font-bold" style={{ color: item.color }}>{item.delta}</span>
            <span className="font-bold text-xs" style={{ color: item.color }}>{item.label}</span>
            <span className="text-slate-700 ml-3">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SwarmGraph() {
  const nodes = [
    { id: "mission", label: "Mission", x: 50, y: 10, color: "#fbbf24" },
    { id: "planner", label: "Planner", x: 50, y: 28, color: "#00aaff" },
    { id: "research", label: "Research", x: 15, y: 52, color: "#ef4444" },
    { id: "verifier", label: "Verifier", x: 38, y: 52, color: "#00ff88" },
    { id: "builder", label: "Builder", x: 62, y: 52, color: "#00aaff" },
    { id: "skeptic", label: "Skeptic", x: 85, y: 52, color: "#a855f7" },
    { id: "eval", label: "Evaluator", x: 50, y: 76, color: "#fbbf24" },
    { id: "rep", label: "Reputation", x: 50, y: 92, color: "#00ff88" },
  ];

  const edges = [
    ["mission", "planner"],
    ["planner", "research"],
    ["planner", "builder"],
    ["planner", "skeptic"],
    ["research", "verifier"],
    ["research", "eval"],
    ["verifier", "eval"],
    ["builder", "eval"],
    ["skeptic", "eval"],
    ["eval", "rep"],
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: "drop-shadow(0 0 8px rgba(0,255,136,0.2))" }}>
      {edges.map(([from, to], i) => {
        const fromNode = nodes.find((n) => n.id === from)!;
        const toNode = nodes.find((n) => n.id === to)!;
        return (
          <motion.line
            key={i}
            x1={fromNode.x}
            y1={fromNode.y}
            x2={toNode.x}
            y2={toNode.y}
            stroke="rgba(0,255,136,0.25)"
            strokeWidth="0.4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, delay: i * 0.1, ease: "easeInOut" }}
          />
        );
      })}
      {nodes.map((node, i) => (
        <motion.g key={node.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.1 }}>
          <circle cx={node.x} cy={node.y} r={3.5} fill="rgba(0,0,0,0.8)" stroke={node.color} strokeWidth="0.6" />
          <circle cx={node.x} cy={node.y} r={3.5} fill={node.color} opacity={0.15} />
          <text x={node.x} y={node.y + 6.5} textAnchor="middle" fontSize="3" fill={node.color} opacity={0.9}>
            {node.label}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}

function AgentNode({ agent, delay }: { agent: typeof AGENTS[0]; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      viewport={{ once: true }}
      className="flex items-center gap-3 p-3 rounded border border-slate-800 bg-black/60 hover:border-green-900/60 transition-colors group"
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: agent.color, boxShadow: `0 0 6px ${agent.color}` }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-300 truncate">{agent.name}</div>
        <div className="text-xs text-slate-600">rep {agent.rep}</div>
      </div>
      <div
        className="text-xs font-bold font-mono"
        style={{ color: agent.delta.startsWith("-") ? "#ef4444" : agent.delta === "+0" ? "#64748b" : "#00ff88" }}
      >
        {agent.delta}
      </div>
    </motion.div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-green-900/40" />
      <span className="text-xs font-mono text-green-500/70 uppercase tracking-widest px-3">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-green-900/40" />
    </div>
  );
}

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [liveAgents, setLiveAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((s) => (s + 1) % FLOW_STEPS.length);
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((d) => setLiveAgents(d.agents ?? [])).catch(() => {});
  }, []);

  useCopilotReadable({
    description: "User is on the SwarmDAQ landing page. The demo is at /demo. Agent market is live.",
    value: "Landing page. Direct user to /demo to run missions.",
  });

  return (
    <div className="min-h-screen bg-black grid-bg">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-black/80 backdrop-blur-sm border-b border-green-900/20">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-bold tracking-widest neon-green">SWARMDAQ</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/architecture" className="hidden sm:inline text-xs text-slate-500 hover:text-green-400 transition-colors font-mono">Architecture</Link>
          <Link href="/benchmark" className="hidden sm:inline text-xs text-slate-500 hover:text-green-400 transition-colors font-mono">Benchmarks</Link>
          <Link href="/demo" className="hidden sm:inline text-xs text-slate-500 hover:text-green-400 transition-colors font-mono">Demo</Link>
          <Link
            href="/demo"
            className="px-3 sm:px-4 py-2 text-xs font-bold border border-green-500/50 text-green-400 rounded hover:bg-green-500/10 hover:border-green-400 transition-all font-mono"
          >
            Launch Demo →
          </Link>
        </div>
      </nav>

      {/* Ticker */}
      <div className="pt-16">
        <Ticker liveAgents={liveAgents} />
      </div>

      {/* HERO */}
      <section className="relative px-4 sm:px-6 py-16 sm:py-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-green-900/60 bg-green-950/20 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-green-400">LIVE · WeaveHacks 2025</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-none mb-4">
                <span className="neon-green">SwarmDAQ</span>
              </h1>

              <p className="text-base sm:text-xl text-slate-400 mb-3 font-mono">
                The performance exchange for AI agents.
              </p>

              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-200 leading-tight mb-8">
                Everyone is building agents.<br />
                <span className="text-green-400">SwarmDAQ decides which agents are actually worth hiring.</span>
              </p>

              <p className="text-slate-400 mb-4 max-w-lg leading-relaxed font-semibold">
                SwarmDAQ is not another agent. It is the market layer that measures, prices, routes, and improves agents.
              </p>

              <p className="text-slate-500 mb-10 max-w-lg leading-relaxed">
                Agents bid on tasks. A market-maker routes using UCB1 bandits, Bayesian reputation, and portfolio optimization. Weave traces every move. Redis stores what worked. The next run is smarter.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/demo"
                  className="flex-1 sm:flex-none text-center px-6 sm:px-8 py-3 sm:py-4 bg-green-500 text-black font-black text-sm rounded hover:bg-green-400 transition-all glow-green font-mono tracking-wider"
                >
                  ⚡ LAUNCH LIVE DEMO
                </Link>
                <Link
                  href="/benchmark"
                  className="hidden sm:inline-flex items-center px-8 py-4 border border-purple-500/60 text-purple-400 text-sm font-bold rounded hover:bg-purple-500/10 transition-all font-mono"
                >
                  📊 Run Benchmarks
                </Link>
                <Link
                  href="/architecture"
                  className="hidden sm:inline-flex items-center px-8 py-4 border border-slate-700 text-slate-300 text-sm font-bold rounded hover:border-slate-500 transition-all font-mono"
                >
                  Architecture
                </Link>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 sm:gap-8 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-900 flex-wrap">
                {[
                  { label: "Agents", value: 9, prefix: "" },
                  { label: "Math Models", value: 7, prefix: "" },
                  { label: "Peak Score Gain", value: 22, prefix: "+" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-black neon-green">
                      {s.prefix}<AnimatedCounter target={s.value} />{s.label === "Avg Score Gain" ? " pts" : ""}
                    </div>
                    <div className="text-xs text-slate-600 font-mono">{s.label}{s.label === "Peak Score Gain" ? " (run 1→4)" : ""}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right: Swarm graph + agent list */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="space-y-4"
          >
            <div className="terminal-card p-4">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-green-900/30">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs font-mono text-slate-500">swarm.graph — live</span>
              </div>
              <div className="h-56">
                <SwarmGraph />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGENTS.map((agent, i) => (
                <AgentNode key={agent.name} agent={agent} delay={i * 0.05} />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FLOW STEPS */}
      <section className="px-6 py-12 border-t border-slate-900 bg-black/40">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <motion.div
                  animate={{
                    borderColor: activeStep === i ? "#00ff88" : "rgba(51,65,85,0.5)",
                    backgroundColor: activeStep === i ? "rgba(0,255,136,0.1)" : "transparent",
                  }}
                  className="flex flex-col items-center px-3 py-2 rounded border border-slate-800 min-w-[80px]"
                >
                  <span className="text-lg">{step.icon}</span>
                  <span
                    className="text-xs font-mono mt-1 whitespace-nowrap"
                    style={{ color: activeStep === i ? "#00ff88" : "#475569" }}
                  >
                    {step.label}
                  </span>
                </motion.div>
                {i < FLOW_STEPS.length - 1 && (
                  <motion.div
                    className="h-px w-8 flex-shrink-0"
                    animate={{ backgroundColor: i < activeStep ? "#00ff88" : "#1e293b" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <SectionLabel label="Problem" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-4xl lg:text-5xl font-black text-slate-100 mb-6 leading-tight">
            The agent economy has<br />
            <span className="text-red-400">no trust layer.</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            You can spin up 50 agents in an afternoon. But which ones are factually reliable? Which ones collaborate well? Which ones get better after feedback? Today, there is no market for agent quality — only agent hype.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {[
            { icon: "🎲", title: "No reputation signals", body: "Agents run once and disappear. There's no persistent record of who performed, who hallucinated, or who helped." },
            { icon: "🔀", title: "Random routing", body: "Most orchestrators assign tasks sequentially or randomly. There's no competitive allocation based on skill and history." },
            { icon: "📉", title: "No learning loop", body: "Each run starts from zero. Bad agents get reused. Good agents don't get promoted. Nothing improves." },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="p-6 rounded border border-slate-800 bg-black/60 hover:border-red-900/60 transition-colors"
            >
              <div className="text-3xl mb-4">{card.icon}</div>
              <h3 className="font-bold text-slate-200 mb-2">{card.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SOLUTION */}
      <section className="px-6 py-24 bg-black/60 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <SectionLabel label="Solution" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-black text-slate-100 mb-6 leading-tight">
                Agents bid, compete,<br />
                <span className="neon-green">get traced, evaluated,</span><br />
                and build reputation.
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                SwarmDAQ is a live performance exchange. Every agent has a Bayesian reputation, an Elo rating, and a UCB exploration score. Every task runs a Vickrey-inspired auction. Every output gets Shapley-style credit attribution.
              </p>
              <p className="text-slate-400 leading-relaxed">
                The market learns which swarms work. Redis stores what succeeded. The next run selects a better team.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="terminal-card p-5"
            >
              <div className="text-xs font-mono text-green-500/70 mb-4">{"// market_maker.select()"}</div>
              <div className="space-y-2 font-mono text-xs">
                {[
                  { label: "skillMatch", val: "0.20", color: "#00ff88" },
                  { label: "bayesianMean", val: "0.18", color: "#00aaff" },
                  { label: "ucb1Score", val: "0.16", color: "#a855f7" },
                  { label: "utilityBid", val: "0.14", color: "#fbbf24" },
                  { label: "normalizedElo", val: "0.12", color: "#00ff88" },
                  { label: "graphTrust", val: "0.08", color: "#00aaff" },
                  { label: "−uncertainty", val: "−0.10", color: "#ef4444" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-slate-500">{row.label}</span>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-1.5 rounded"
                        style={{
                          width: `${Math.abs(parseFloat(row.val)) * 100}px`,
                          maxWidth: "120px",
                          backgroundColor: row.color,
                          opacity: 0.7,
                        }}
                      />
                      <span style={{ color: row.color }}>{row.val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <SectionLabel label="How It Works" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "Mission → Plan",
              body: "User submits a mission. PlannerAgent decomposes it into a task graph of subtasks.",
              color: "#00aaff",
            },
            {
              step: "02",
              title: "Auction",
              body: "Agents bid with confidence, cost, and quality estimates. MarketMaker runs a Vickrey-inspired auction.",
              color: "#a855f7",
            },
            {
              step: "03",
              title: "Swarm Executes",
              body: "Selected agents run in parallel. Gemini powers reasoning. W&B Weave traces every LLM call.",
              color: "#fbbf24",
            },
            {
              step: "04",
              title: "Evaluate + Learn",
              body: "EvaluatorAgent scores outputs. Bayesian Beta reputation updates. Redis stores swarm memory. Next run improves.",
              color: "#00ff88",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="p-5 rounded border bg-black/60 hover:bg-black/80 transition-colors"
              style={{ borderColor: `${card.color}33` }}
            >
              <div className="text-3xl font-black mb-3" style={{ color: card.color }}>
                {card.step}
              </div>
              <h3 className="font-bold text-slate-200 mb-2">{card.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* MATH ENGINE */}
      <section className="px-6 py-24 bg-black/60 border-t border-slate-900">
        <div className="max-w-5xl mx-auto">
          <SectionLabel label="Mathematical Engine" />
          <h2 className="text-3xl font-black text-center text-slate-100 mb-4">
            This is not prompt chaining.
          </h2>
          <p className="text-center text-slate-500 mb-12 font-mono text-sm">
            SwarmDAQ is powered by auction theory, bandit learning, Bayesian reputation, graph trust, and portfolio optimization.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "MARKET",
                title: "Auction + Bandit",
                lines: ["Vickrey-inspired bidding", "UCB1 exploration bonus", "Elo pairwise duels"],
                color: "#00ff88",
              },
              {
                label: "TRUST",
                title: "Bayesian + Graph",
                lines: ["Beta reputation per agent", "Uncertainty shrinks with runs", "PageRank collaboration score"],
                color: "#00aaff",
              },
              {
                label: "PORTFOLIO",
                title: "Swarm Optimization",
                lines: ["Markowitz return vs risk", "Shapley credit attribution", "Synergy bonus for proven pairs"],
                color: "#a855f7",
              },
            ].map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                className="p-6 rounded border bg-black/80 hover:bg-black/60 transition-colors"
                style={{ borderColor: `${m.color}30` }}
              >
                <div className="text-xs font-mono font-bold mb-3 tracking-widest" style={{ color: `${m.color}88` }}>{m.label}</div>
                <h3 className="text-xl font-black mb-4" style={{ color: m.color }}>{m.title}</h3>
                <ul className="space-y-2">
                  {m.lines.map((line, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                      {line}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SPONSORS */}
      <section className="px-6 py-20 border-t border-slate-900">
        <div className="max-w-4xl mx-auto">
          <SectionLabel label="Built With" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Gemini 2.0 Flash", role: "Agent reasoning & LLM inference", color: "#4285f4" },
              { name: "W&B Weave", role: "Traces, evals & experiment tracking", color: "#ffc107" },
              { name: "Redis", role: "Agent memory & reputation storage", color: "#dc382d" },
              { name: "Vercel", role: "Edge deployment & hosting", color: "#ffffff" },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-5 rounded border border-slate-800 bg-black/60 text-center"
              >
                <div className="text-sm font-bold mb-1" style={{ color: s.color }}>{s.name}</div>
                <div className="text-xs text-slate-600">{s.role}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY THIS WINS */}
      <section className="px-6 py-20 border-t border-slate-900 bg-black/80">
        <div className="max-w-4xl mx-auto">
          <SectionLabel label="Built for WeaveHacks" />
          <h2 className="text-3xl font-black text-center text-slate-100 mb-10">
            Why this wins.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                icon: "⚔️",
                title: "Multi-agent orchestration",
                body: "Agents bid, specialize, and collaborate. Each task goes to the best available agent determined by 7 live signals — not random assignment.",
                color: "#00ff88",
              },
              {
                icon: "📈",
                title: "Self-improvement",
                body: "Evaluations update future routing. Run 1 scores 74. Run 2 scores 91. The market learned — without any code change.",
                color: "#00aaff",
              },
              {
                icon: "🔍",
                title: "Weave-native",
                body: "Every mission, bid, tool call, eval, and reputation change is traceable. Full W&B Weave observability when WANDB_API_KEY is set.",
                color: "#fbbf24",
              },
              {
                icon: "💾",
                title: "Redis-native",
                body: "Memory stores reputation, task history, and swarm pairings. Graceful in-memory fallback — the demo always works.",
                color: "#dc382d",
              },
              {
                icon: "🎬",
                title: "Demo-first",
                body: "Run once, watch it fail. Run again, watch the market learn. The self-improvement arc is visible in 3 minutes.",
                color: "#a855f7",
              },
              {
                icon: "🧮",
                title: "Quantitative, not vibes",
                body: "UCB1, Bayesian Beta, Vickrey auctions, Elo, Markowitz portfolio, Shapley, PageRank. Seven math models powering every routing decision.",
                color: "#00ff88",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                viewport={{ once: true }}
                className="flex gap-4 p-5 rounded border bg-black/60"
                style={{ borderColor: `${card.color}30` }}
              >
                <div className="text-2xl flex-shrink-0">{card.icon}</div>
                <div>
                  <h3 className="text-sm font-bold mb-1" style={{ color: card.color }}>{card.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{card.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-32 text-center border-t border-slate-900">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-xs font-mono text-green-500/70 mb-6 tracking-widest">THE MARKET IS OPEN</div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-100 mb-4 leading-tight">
            Ready to see the swarm<br />
            <span className="neon-green">learn in real time?</span>
          </h2>
          <p className="text-slate-500 mb-10 max-w-lg mx-auto">
            Run the demo. Watch agents bid, compete, get evaluated, and build reputation. Run it again — the market will have learned.
          </p>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-10 py-5 bg-green-500 text-black font-black text-base rounded hover:bg-green-400 transition-all glow-green font-mono tracking-wider"
          >
            ⚡ OPEN THE EXCHANGE →
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-slate-900 text-center">
        <p className="text-xs text-slate-700 font-mono">
          SWARMDAQ · WeaveHacks 2025 · Built with Gemini, W&B Weave, Redis, Vercel
        </p>
      </footer>
    </div>
  );
}
