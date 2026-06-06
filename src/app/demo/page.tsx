"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { MissionResult, Agent, AgentBid, ReputationChange, ShapleyContribution, AgentMessage } from "@/lib/types";
import type { TraceSummary } from "@/app/api/traces/route";

const DEFAULT_MISSION =
  "Build a launch plan for an AI product that helps students turn messy research into a demo-ready hackathon project. Include market positioning, landing page copy, risk analysis, and a 90-second pitch.";

const STATUS_COLOR: Record<string, string> = {
  idle: "#475569", bidding: "#fbbf24", selected: "#00aaff",
  running: "#00ff88", done: "#22c55e", promoted: "#00ff88", penalized: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  idle: "idle", bidding: "bidding", selected: "selected ✓",
  running: "● running", done: "done", promoted: "▲ promoted", penalized: "▼ penalized",
};

// ── Trust graph data ─────────────────────────────────────────────────────────

const AGENT_NODES = [
  { id: "market_maker",    name: "Market\nMaker",    x: 160, y: 140, color: "#22c55e" },
  { id: "planner",         name: "Planner",          x: 160, y:  36, color: "#00aaff" },
  { id: "evaluator",       name: "Evaluator",        x: 233, y:  69, color: "#a855f7" },
  { id: "reputation",      name: "Repute",           x: 262, y: 140, color: "#64748b" },
  { id: "skeptic",         name: "Skeptic",          x: 233, y: 213, color: "#fbbf24" },
  { id: "builder",         name: "Builder",          x: 160, y: 246, color: "#06b6d4" },
  { id: "pitch",           name: "Pitch",            x:  87, y: 213, color: "#f472b6" },
  { id: "source_verifier", name: "Source\nVerify",   x:  58, y: 140, color: "#00ff88" },
  { id: "research",        name: "Research",         x:  87, y:  69, color: "#ef4444" },
];

const BASE_EDGES = [
  { from: "research",      to: "source_verifier", baseColor: "#00aaff" },
  { from: "skeptic",       to: "source_verifier", baseColor: "#a855f7" },
  { from: "pitch",         to: "builder",         baseColor: "#f472b6" },
  { from: "skeptic",       to: "pitch",           baseColor: "#fbbf24" },
  { from: "planner",       to: "research",        baseColor: "#1e3a5f" },
  { from: "planner",       to: "builder",         baseColor: "#1e3a5f" },
  { from: "evaluator",     to: "reputation",      baseColor: "#2d1b69" },
  { from: "market_maker",  to: "planner",         baseColor: "#14532d" },
  { from: "market_maker",  to: "evaluator",       baseColor: "#14532d" },
];

// ── Message feed ─────────────────────────────────────────────────────────────

const MSG_COLORS: Record<AgentMessage["type"], string> = {
  info: "#64748b", flag: "#ef4444", confirm: "#00ff88", synergy: "#00aaff", penalty: "#f97316",
};
const MSG_ICONS: Record<AgentMessage["type"], string> = {
  info: "→", flag: "⚠", confirm: "✓", synergy: "⚡", penalty: "↓",
};

// ── Components ───────────────────────────────────────────────────────────────

function AgentCard({ agent, bid, delay = 0 }: { agent: Agent; bid?: AgentBid; delay?: number }) {
  const color = STATUS_COLOR[agent.status] ?? "#475569";
  const isRunning = agent.status === "running";
  const isSelected = ["selected", "running", "done", "promoted", "penalized"].includes(agent.status);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`p-3 rounded border transition-all ${isRunning ? "agent-running" : ""}`}
      style={{ borderColor: isSelected ? `${color}60` : "#1e293b", backgroundColor: isSelected ? `${color}08` : "#050505" }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="text-xs font-bold text-slate-200">{agent.name}</span>
        </div>
        <span className="text-xs font-mono" style={{ color }}>{STATUS_LABEL[agent.status]}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono mb-2">
        <span className="text-slate-600">rep</span><span className="text-slate-300">{agent.reputation}</span>
        <span className="text-slate-600">factual</span><span className="text-slate-300">{(agent.factuality * 100).toFixed(0)}%</span>
        <span className="text-slate-600">elo</span><span className="text-slate-300">{Math.round(agent.elo)}</span>
        <span className="text-slate-600">bayes</span><span style={{ color: "#00aaff" }}>{(agent.bayesianMean * 100).toFixed(0)}%</span>
      </div>
      {bid?.isWinner && (
        <div className="mt-2 pt-2 border-t border-slate-800 text-xs font-mono space-y-0.5">
          <div className="flex justify-between"><span className="text-slate-600">bid utility</span><span className="text-green-400">{bid.utilityBid.toFixed(3)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">confidence</span><span className="text-slate-300">{(bid.confidence * 100).toFixed(0)}%</span></div>
          {bid.clearingPrice && <div className="flex justify-between"><span className="text-slate-600">clearing $</span><span className="text-amber-400">${bid.clearingPrice.toFixed(3)}</span></div>}
        </div>
      )}
    </motion.div>
  );
}

function Leaderboard({ agents }: { agents: Agent[] }) {
  const sorted = [...agents].sort((a, b) => b.reputation - a.reputation);
  return (
    <div className="space-y-1">
      {sorted.map((a, i) => (
        <div key={a.id} className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-700 w-4">{i + 1}</span>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[a.status] ?? "#475569" }} />
          <span className="flex-1 text-slate-400 truncate">{a.name}</span>
          <div className="flex items-center gap-1">
            <div className="h-1 rounded" style={{ width: `${(a.reputation / 100) * 60}px`, backgroundColor: a.reputation > 85 ? "#00ff88" : a.reputation > 70 ? "#fbbf24" : "#ef4444", opacity: 0.7 }} />
            <span className="text-slate-300 w-6 text-right">{a.reputation}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuctionLog({ bids }: { bids: AgentBid[] }) {
  const grouped: Record<string, AgentBid[]> = {};
  for (const b of bids) { if (!grouped[b.taskId]) grouped[b.taskId] = []; grouped[b.taskId].push(b); }
  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([taskId, taskBids]) => {
        const sorted = [...taskBids].sort((a, b) => b.utilityBid - a.utilityBid);
        return (
          <div key={taskId}>
            <div className="text-xs font-mono text-slate-600 mb-1 uppercase tracking-wider">{taskId}</div>
            {sorted.slice(0, 3).map((bid) => (
              <div key={bid.agentId} className="flex items-center gap-2 text-xs font-mono py-0.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: bid.isWinner ? "#00ff88" : "#334155" }} />
                <span className="flex-1 text-slate-500">{bid.agentId}</span>
                <span style={{ color: bid.isWinner ? "#00ff88" : "#475569" }}>{bid.utilityBid.toFixed(3)}</span>
                {bid.isWinner && <span className="text-green-500 text-xs">WIN</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ScorePanel({ score, runNum, improvement }: {
  score: MissionResult["evalScore"]; runNum: number; improvement?: MissionResult["improvementFromPrevious"];
}) {
  const isRegression = improvement && improvement.currentScore < improvement.previousScore;
  const dims = [
    { key: "quality", label: "Quality" }, { key: "factuality", label: "Factuality" },
    { key: "usefulness", label: "Usefulness" }, { key: "specificity", label: "Specificity" },
    { key: "actionability", label: "Actionability" }, { key: "collaboration", label: "Collab" },
  ] as const;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <div className="text-4xl font-black" style={{ color: score.overall >= 90 ? "#00ff88" : score.overall >= 85 ? "#fbbf24" : "#ef4444" }}>
          {score.overall}
        </div>
        <div className="text-sm text-slate-500 font-mono">/ 100</div>
        {runNum >= 2 && improvement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="ml-auto px-3 py-1 rounded border text-xs font-bold font-mono"
            style={{
              backgroundColor: isRegression ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
              borderColor: isRegression ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)",
              color: isRegression ? "#ef4444" : "#4ade80",
            }}
          >
            {improvement.currentScore - improvement.previousScore > 0 ? "+" : ""}
            {improvement.currentScore - improvement.previousScore} pts {isRegression ? "↓" : "↑"}
          </motion.div>
        )}
      </div>
      <div className="space-y-2">
        {dims.map((d) => {
          const val = score[d.key];
          const color = val >= 88 ? "#00ff88" : val >= 75 ? "#fbbf24" : "#ef4444";
          return (
            <div key={d.key} className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-600 w-24">{d.label}</span>
              <div className="flex-1 h-1.5 bg-slate-900 rounded overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded" style={{ backgroundColor: color }} />
              </div>
              <span className="w-8 text-right" style={{ color }}>{val}</span>
            </div>
          );
        })}
      </div>
      {improvement && runNum >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 rounded border"
          style={{
            borderColor: isRegression ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)",
            backgroundColor: isRegression ? "rgba(239,68,68,0.05)" : "rgba(5,46,22,0.2)",
          }}
        >
          <div className="text-xs font-mono font-bold mb-2" style={{ color: isRegression ? "#ef4444" : runNum >= 4 ? "#22d3ee" : "#4ade80" }}>
            {isRegression ? "⚠ MARKET OVER-ROTATED" : runNum >= 4 ? "✦ MARKET CALIBRATED" : "✓ MARKET LEARNED"}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
            {[
              ["factuality", improvement.factualityDelta, ""],
              ["confidence", improvement.confidenceDelta, "%"],
              ["risk cover", improvement.riskDelta, "%"],
              ["cost delta", null, ""],
              ["swarm obj", improvement.swarmObjectiveDelta, ""],
            ].map(([label, val, suffix]) => {
              if (label === "cost delta") return (
                <><span key="cl" className="text-slate-600">cost delta</span><span key="cv" className="text-amber-400">+${improvement.costDelta.toFixed(2)}</span></>
              );
              const n = val as number;
              const positive = label === "risk cover" ? n <= 0 : n >= 0;
              return (
                <><span key={`${label}l`} className="text-slate-600">{label}</span>
                <span key={`${label}v`} style={{ color: positive ? "#4ade80" : "#ef4444" }}>
                  {n > 0 ? "+" : ""}{typeof n === "number" ? n.toFixed(label === "swarm obj" ? 2 : 0) : n}{suffix}
                </span></>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ReputationLog({ changes }: { changes: ReputationChange[] }) {
  return (
    <div className="space-y-2">
      {changes.map((c) => (
        <motion.div key={c.agentId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 text-xs font-mono">
          <span className="font-bold w-8 flex-shrink-0" style={{ color: c.delta > 0 ? "#00ff88" : c.delta < 0 ? "#ef4444" : "#64748b" }}>
            {c.delta > 0 ? `+${c.delta}` : c.delta}
          </span>
          <div>
            <div className="text-slate-300">{c.agentName}</div>
            <div className="text-slate-600">{c.reason}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function ContributionLedger({ contributions }: { contributions: ShapleyContribution[] }) {
  return (
    <div className="space-y-2">
      {contributions.map((c) => (
        <div key={c.agentId} className="flex items-center gap-2 text-xs font-mono">
          <div className="h-1.5 rounded flex-shrink-0" style={{ width: `${Math.min(c.contribution * 4, 80)}px`, backgroundColor: "#00ff88", opacity: 0.7 }} />
          <span className="text-slate-400 flex-1">{c.agentName}</span>
          <span className="text-green-400">+{c.contribution.toFixed(1)}</span>
          <span className="text-slate-600 text-xs">{c.dimension}</span>
        </div>
      ))}
    </div>
  );
}

function MathPanel({ snapshot, showMath }: { snapshot: MissionResult["mathSnapshot"]; showMath: boolean }) {
  if (!showMath) return null;
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4">
      <div>
        <div className="text-xs font-mono text-slate-600 mb-2 uppercase tracking-wider">UCB1 Scores</div>
        {Object.entries(snapshot.ucbScores).map(([id, score]) => (
          <div key={id} className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-600 w-28 truncate">{id}</span>
            <div className="flex-1 h-1 bg-slate-900 rounded overflow-hidden"><div className="h-full bg-purple-500/70 rounded" style={{ width: `${score * 100}%` }} /></div>
            <span className="text-purple-400 w-12 text-right">{score.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs font-mono text-slate-600 mb-2 uppercase tracking-wider">Bayesian Trust</div>
        {Object.entries(snapshot.bayesianMeans).map(([id, mean]) => (
          <div key={id} className="flex items-center gap-2 text-xs font-mono mb-1">
            <span className="text-slate-600 w-28 truncate">{id}</span>
            <div className="flex-1 h-1 bg-slate-900 rounded overflow-hidden"><div className="h-full bg-blue-500/70 rounded" style={{ width: `${mean * 100}%` }} /></div>
            <span className="text-blue-400 w-12 text-right">{mean.toFixed(3)}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs font-mono text-slate-600 mb-2 uppercase tracking-wider">Swarm Portfolio</div>
        <div className="grid grid-cols-2 gap-1 text-xs font-mono">
          <span className="text-slate-600">E[return]</span><span className="text-green-400">{snapshot.swarmPortfolio.expectedReturn.toFixed(3)}</span>
          <span className="text-slate-600">variance</span><span className="text-amber-400">{snapshot.swarmPortfolio.variance.toFixed(3)}</span>
          <span className="text-slate-600">synergy</span><span className="text-blue-400">+{snapshot.swarmPortfolio.synergyBonus.toFixed(3)}</span>
          <span className="text-slate-600">objective</span><span className="text-green-400 font-bold">{snapshot.swarmPortfolio.objective.toFixed(3)}</span>
        </div>
      </div>
      <div>
        <div className="text-xs font-mono text-slate-600 mb-2 uppercase tracking-wider">Bradley-Terry P(A beats B)</div>
        {snapshot.pairwiseProbabilities.map((p, i) => (
          <div key={i} className="text-xs font-mono text-slate-500 mb-0.5">
            P({p.a} &gt; {p.b}) on {p.dimension} = <span className="text-blue-400">{(p.pABeatsB * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function OutputPanel({ result }: { result: MissionResult }) {
  const [tab, setTab] = useState<"positioning" | "pitch" | "risks">("positioning");
  const [copied, setCopied] = useState(false);
  const content = { positioning: result.output.positioning, pitch: result.output.pitch, risks: result.output.risks.join("\n") };
  const copyPitch = () => { navigator.clipboard.writeText(result.output.pitch); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {(["positioning", "pitch", "risks"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-1 text-xs font-mono rounded border transition-colors"
            style={{ borderColor: tab === t ? "#00ff88" : "#1e293b", color: tab === t ? "#00ff88" : "#475569", backgroundColor: tab === t ? "rgba(0,255,136,0.05)" : "transparent" }}>
            {t}
          </button>
        ))}
        {tab === "pitch" && (
          <button onClick={copyPitch} className="ml-auto px-3 py-1 text-xs font-mono rounded border border-slate-700 text-slate-400 hover:border-green-600 hover:text-green-400 transition-colors">
            {copied ? "✓ copied" : "copy pitch"}
          </button>
        )}
      </div>
      <div className="text-xs font-mono text-slate-400 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">{content[tab]}</div>
    </div>
  );
}

// ── NEW: Trust Graph ─────────────────────────────────────────────────────────

function TrustGraph({ result, agents }: { result: MissionResult | null; agents: Agent[] }) {
  const runNum = result?.runNumber ?? 0;
  const trustMap: Record<string, number> = {};
  if (result?.mathSnapshot?.graphTrust) {
    Object.assign(trustMap, result.mathSnapshot.graphTrust);
  } else {
    for (const a of agents) trustMap[a.id] = a.graphTrust ?? 0.5;
  }
  const activeIds = new Set(result?.selectedAgents?.map((a) => a.id) ?? []);
  const penalizedIds = new Set(result?.reputationChanges?.filter((c) => c.delta < 0).map((c) => c.agentId) ?? []);
  const promotedIds = new Set(result?.reputationChanges?.filter((c) => c.delta > 0).map((c) => c.agentId) ?? []);

  const getEdge = (from: string, to: string, baseColor: string) => {
    const ft = trustMap[from] ?? 0.3;
    const tt = trustMap[to] ?? 0.3;
    let opacity = (ft + tt) / 2 * 0.6;
    let color = baseColor;
    let width = 1;

    if (from === "research" && to === "source_verifier" && runNum >= 2) { opacity = 0.85; width = 2; color = "#00aaff"; }
    if (from === "pitch" && to === "builder" && runNum >= 4) { opacity = 0.85; width = 2; color = "#f472b6"; }
    if (from === "skeptic" && to === "pitch") {
      if (runNum === 3) { color = "#ef4444"; opacity = 0.9; width = 2.5; }
      else if (runNum >= 4) { color = "#00ff88"; opacity = 0.8; width = 2; }
    }
    return { opacity, color, width };
  };

  return (
    <svg viewBox="0 0 320 284" className="w-full" style={{ maxHeight: 220 }}>
      {/* Edges */}
      {BASE_EDGES.map((edge) => {
        const fromNode = AGENT_NODES.find((n) => n.id === edge.from);
        const toNode = AGENT_NODES.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return null;
        const { opacity, color, width } = getEdge(edge.from, edge.to, edge.baseColor);
        return (
          <line key={`${edge.from}-${edge.to}`}
            x1={fromNode.x} y1={fromNode.y} x2={toNode.x} y2={toNode.y}
            stroke={color} strokeWidth={width} opacity={opacity}
          />
        );
      })}
      {/* Nodes */}
      {AGENT_NODES.map((node) => {
        const trust = trustMap[node.id] ?? 0.5;
        const isActive = activeIds.has(node.id);
        const isPenalized = penalizedIds.has(node.id);
        const isPromoted = promotedIds.has(node.id);
        const nodeColor = isPenalized ? "#ef4444" : isPromoted ? "#00ff88" : node.color;
        const r = 10 + trust * 6;
        const lines = node.name.split("\n");
        return (
          <g key={node.id}>
            {isActive && <circle cx={node.x} cy={node.y} r={r + 5} fill="none" stroke={nodeColor} strokeWidth={1} opacity={0.25} />}
            <circle cx={node.x} cy={node.y} r={r} fill={`${nodeColor}18`} stroke={nodeColor} strokeWidth={isActive ? 2 : 1} opacity={isActive ? 1 : 0.45} />
            {lines.map((line, li) => (
              <text key={li} x={node.x} y={node.y + r + 9 + li * 8} textAnchor="middle" fontSize="6.5" fill={isActive ? nodeColor : "#475569"} fontFamily="monospace">
                {line}
              </text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── NEW: Message Feed ────────────────────────────────────────────────────────

function MessageFeed({ messages }: { messages: AgentMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);
  if (messages.length === 0) return null;
  return (
    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
      {messages.map((msg, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
          className="flex items-start gap-2 text-xs font-mono">
          <span className="flex-shrink-0 w-3" style={{ color: MSG_COLORS[msg.type] }}>{MSG_ICONS[msg.type]}</span>
          <span className="text-slate-700 flex-shrink-0 truncate" style={{ maxWidth: 120 }}>
            {msg.fromId.replace("_", "-")}
            {msg.toId !== "all" ? ` → ${msg.toId.replace("_", "-")}` : " → all"}:
          </span>
          <span className="leading-relaxed" style={{ color: MSG_COLORS[msg.type] }}>{msg.message}</span>
        </motion.div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ── NEW: Fast Demo Timeline ──────────────────────────────────────────────────

function FastDemoTimeline({ results, selectedRun, onSelect }: {
  results: MissionResult[]; selectedRun: number | null; onSelect: (r: MissionResult) => void;
}) {
  const scoreColor = (s: number) => s >= 92 ? "#22d3ee" : s >= 88 ? "#00ff88" : s >= 83 ? "#fbbf24" : "#ef4444";
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4].map((n) => {
        const r = results.find((x) => x.runNumber === n);
        const color = r ? scoreColor(r.evalScore.overall) : "#1e293b";
        const isSelected = selectedRun === n;
        return (
          <button key={n} onClick={() => r && onSelect(r)} disabled={!r}
            className="flex-1 p-2 rounded border text-center transition-all"
            style={{ borderColor: isSelected ? color : r ? `${color}40` : "#1e293b", backgroundColor: isSelected ? `${color}12` : "transparent", cursor: r ? "pointer" : "default" }}>
            <div className="text-xs text-slate-600 font-mono mb-0.5">Run {n}</div>
            {r ? (
              <>
                <div className="text-xl font-black font-mono" style={{ color }}>{r.evalScore.overall}</div>
                {n > 1 && r.improvementFromPrevious && (
                  <div className="text-xs font-mono" style={{ color: r.evalScore.overall >= r.improvementFromPrevious.previousScore ? "#4ade80" : "#ef4444" }}>
                    {r.evalScore.overall >= r.improvementFromPrevious.previousScore ? "+" : ""}
                    {r.evalScore.overall - r.improvementFromPrevious.previousScore}
                  </div>
                )}
              </>
            ) : (
              <div className="text-xl font-black font-mono text-slate-800">·</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── NEW: Weave Trace Panel ───────────────────────────────────────────────────

function WeaveTracePanel({ traces, loading }: { traces: TraceSummary | null; loading: boolean }) {
  const hasData = traces && traces.totalCalls > 0;
  return (
    <div>
      {loading && (
        <div className="text-xs font-mono text-slate-700 animate-pulse">fetching from W&B...</div>
      )}
      {!loading && !hasData && (
        <div className="text-xs font-mono text-slate-800">no traces yet — run a mission first</div>
      )}
      {!loading && hasData && traces && (
        <>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono mb-3">
            <span className="text-slate-600">LLM calls</span>
            <span className="text-purple-400 font-bold">{traces.totalCalls}</span>
            <span className="text-slate-600">input tokens</span>
            <span className="text-blue-400">{traces.totalInputTokens.toLocaleString()}</span>
            <span className="text-slate-600">output tokens</span>
            <span className="text-green-400">{traces.totalOutputTokens.toLocaleString()}</span>
            <span className="text-slate-600">avg latency</span>
            <span className="text-amber-400">{traces.avgLatencyMs}ms</span>
          </div>
          <div className="space-y-1">
            {traces.calls.slice(0, 6).map((c, i) => (
              <motion.div key={c.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 text-xs font-mono py-0.5 border-b border-slate-900">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500/70 flex-shrink-0" />
                <span className="flex-1 text-slate-600 truncate">{c.op_name}</span>
                {c.totalTokens > 0 && <span className="text-slate-700">{c.totalTokens}tok</span>}
                {c.latencyMs > 0 && (
                  <span style={{ color: c.latencyMs < 2000 ? "#22c55e" : c.latencyMs < 5000 ? "#fbbf24" : "#ef4444" }}>
                    {c.latencyMs < 1000 ? `${c.latencyMs}ms` : `${(c.latencyMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
          <a href="https://wandb.ai/vborysenko-uc-berkeley/swarmdaq/weave" target="_blank" rel="noopener noreferrer"
            className="mt-3 block text-xs font-mono text-purple-700 hover:text-purple-400 transition-colors">
            open full trace explorer ↗
          </a>
        </>
      )}
    </div>
  );
}

// ── Page types ───────────────────────────────────────────────────────────────

type Phase = "idle" | "planning" | "auction" | "executing" | "evaluating" | "updating" | "done";
const PHASE_LABELS: Record<Phase, string> = {
  idle: "Waiting", planning: "Planning →", auction: "Auction →",
  executing: "Executing →", evaluating: "Evaluating →", updating: "Updating Reputation →", done: "Complete ✓",
};

// ── Main page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [mission, setMission] = useState(DEFAULT_MISSION);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<MissionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMath, setShowMath] = useState(false);
  const [liveAgents, setLiveAgents] = useState<Agent[]>([]);
  const [runCount, setRunCount] = useState(0);
  const [liveMessages, setLiveMessages] = useState<AgentMessage[]>([]);
  const [weaveCount, setWeaveCount] = useState(0);
  const [fastDemoResults, setFastDemoResults] = useState<MissionResult[]>([]);
  const [fastDemoActive, setFastDemoActive] = useState(false);
  const [selectedFastRun, setSelectedFastRun] = useState<number | null>(null);
  const [traceSummary, setTraceSummary] = useState<TraceSummary | null>(null);
  const [tracesLoading, setTracesLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  const fetchTraces = async () => {
    setTracesLoading(true);
    try {
      const res = await fetch("/api/traces");
      if (res.ok) setTraceSummary(await res.json());
    } catch {}
    setTracesLoading(false);
  };

  const fetchAgentsRef = useRef(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setLiveAgents(data.agents ?? []);
    } catch {}
  });

  useEffect(() => { void fetchAgentsRef.current(); }, []);

  const animateMessages = async (messages: AgentMessage[]) => {
    for (const msg of messages) {
      await new Promise((r) => setTimeout(r, 280));
      setLiveMessages((prev) => [...prev, msg]);
    }
  };

  const runDemo = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLiveMessages([]);
    setSelectedFastRun(null);

    const phases: Phase[] = ["planning", "auction", "executing", "evaluating", "updating", "done"];
    let pi = 0;
    const advance = () => setPhase(phases[pi++]);

    advance();
    await new Promise((r) => setTimeout(r, 800));
    await fetchAgentsRef.current();
    advance();
    await new Promise((r) => setTimeout(r, 600));

    try {
      const res = await fetch("/api/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission, runNumber: runCount + 1 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      advance();
      await new Promise((r) => setTimeout(r, 400));
      await fetchAgentsRef.current();

      const data: MissionResult = await res.json();

      advance();
      void animateMessages(data.agentMessages ?? []);
      await new Promise((r) => setTimeout(r, 500));
      advance();
      await new Promise((r) => setTimeout(r, 500));

      setResult(data);
      setRunCount((c) => c + 1);
      setWeaveCount((c) => c + (data.agentMessages?.length ?? 6));
      advance();
      setPhase("done");
      await fetchAgentsRef.current();
      void fetchTraces();
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (err) {
      setError(String(err));
      setPhase("idle");
    } finally {
      setLoading(false);
    }
  };

  const runFastDemo = async () => {
    if (fastDemoActive || loading) return;
    setFastDemoActive(true);
    setFastDemoResults([]);
    setSelectedFastRun(null);
    setResult(null);
    setLiveMessages([]);
    setRunCount(0);

    await fetch("/api/reset-demo", { method: "POST" });
    await fetchAgentsRef.current();

    for (let i = 1; i <= 4; i++) {
      try {
        const res = await fetch("/api/mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mission: DEFAULT_MISSION, runNumber: i }),
        });
        const data: MissionResult = await res.json();
        setFastDemoResults((prev) => [...prev, data]);
        setRunCount(i);
        setWeaveCount((c) => c + (data.agentMessages?.length ?? 6));
        // Show last run's messages briefly
        if (i === 4) {
          setSelectedFastRun(4);
          setResult(data);
          void animateMessages(data.agentMessages ?? []);
        }
        await new Promise((r) => setTimeout(r, 500));
      } catch { break; }
    }
    await fetchAgentsRef.current();
    void fetchTraces();
    setFastDemoActive(false);
  };

  const resetDemo = async () => {
    await fetch("/api/reset-demo", { method: "POST" });
    setResult(null); setPhase("idle"); setRunCount(0);
    setLiveMessages([]); setFastDemoResults([]); setSelectedFastRun(null);
    setWeaveCount(0);
    await fetchAgentsRef.current();
  };

  const bidsByAgent: Record<string, AgentBid> = {};
  if (result) { for (const b of result.bids) { if (b.isWinner) bidsByAgent[b.agentId] = b; } }

  const displayResult = selectedFastRun
    ? fastDemoResults.find((r) => r.runNumber === selectedFastRun) ?? result
    : result;

  return (
    <div className="min-h-screen bg-black grid-bg font-mono">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-sm border-b border-green-900/20">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs neon-green font-black tracking-widest">SWARMDAQ</Link>
          <div className="h-3 w-px bg-slate-700" />
          <span className="text-xs text-slate-600">live demo terminal</span>
        </div>
        <div className="flex items-center gap-3">
          {weaveCount > 0 && (
            <a href="https://wandb.ai/vborysenko-uc-berkeley/swarmdaq/weave" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono text-purple-500 hover:text-purple-300 transition-colors">
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
              {weaveCount} W&B traces ↗
            </a>
          )}
          {weaveCount === 0 && (
            <a href="https://wandb.ai/vborysenko-uc-berkeley/swarmdaq/weave" target="_blank" rel="noopener noreferrer"
              className="text-xs text-purple-800 hover:text-purple-500 transition-colors">W&B traces ↗</a>
          )}
          <div className="flex items-center gap-1.5 text-xs cursor-pointer select-none" onClick={() => setShowMath((v) => !v)}>
            <div className="w-8 h-4 rounded-full border transition-colors" style={{ borderColor: showMath ? "#00ff88" : "#334155", backgroundColor: showMath ? "rgba(0,255,136,0.2)" : "transparent" }}>
              <div className="w-3 h-3 rounded-full m-0.5 transition-transform" style={{ backgroundColor: showMath ? "#00ff88" : "#475569", transform: showMath ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            <span className="text-slate-500">math engine</span>
          </div>
          <Link href="/architecture" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">architecture</Link>
          <button onClick={resetDemo} className="text-xs text-red-700 hover:text-red-500 transition-colors">reset</button>
        </div>
      </nav>

      {/* Progress bar */}
      <div className="flex items-center gap-1 px-4 py-2 bg-black/60 border-b border-slate-900 overflow-x-auto">
        {(["planning", "auction", "executing", "evaluating", "updating", "done"] as Phase[]).map((p) => {
          const phases: Phase[] = ["planning", "auction", "executing", "evaluating", "updating", "done"];
          const currentIdx = phases.indexOf(phase);
          const stepIdx = phases.indexOf(p);
          return (
            <div key={p} className="flex items-center gap-1 flex-shrink-0">
              <div className="px-2 py-0.5 rounded text-xs transition-all" style={{
                color: stepIdx === currentIdx ? "#00ff88" : currentIdx > stepIdx ? "#22c55e" : "#334155",
                borderBottom: stepIdx === currentIdx ? "1px solid #00ff88" : currentIdx > stepIdx ? "1px solid #22c55e66" : "1px solid transparent",
              }}>
                {PHASE_LABELS[p]}
              </div>
            </div>
          );
        })}
        {fastDemoActive && (
          <div className="ml-auto flex items-center gap-2 text-xs font-mono">
            <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity }} className="text-purple-400">
              ● AUTO DEMO — run {runCount}/4
            </motion.span>
          </div>
        )}
      </div>

      {/* Fast demo timeline — shown when fast demo has results */}
      {fastDemoResults.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-900 bg-black/40">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-slate-600 font-mono uppercase tracking-wider">4-Run Arc</span>
            <span className="text-xs text-slate-700 font-mono">click any run to inspect</span>
          </div>
          <FastDemoTimeline
            results={fastDemoResults}
            selectedRun={selectedFastRun}
            onSelect={(r) => { setSelectedFastRun(r.runNumber); setResult(r); setLiveMessages(r.agentMessages ?? []); }}
          />
        </div>
      )}

      <div className="p-4 space-y-4 max-w-screen-2xl mx-auto">
        {/* Mission input */}
        <div className="terminal-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-green-500">›</span>
            <span className="text-xs text-slate-500 uppercase tracking-widest">mission input</span>
            {runCount > 0 && <span className="ml-auto text-xs text-slate-600 font-mono">run #{runCount + 1} ready</span>}
          </div>
          <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={3}
            className="w-full bg-transparent text-sm text-slate-300 resize-none outline-none placeholder-slate-700 leading-relaxed"
            placeholder="Enter your mission..." />
          <div className="mt-3 p-3 rounded border border-slate-800 bg-slate-950/60 text-xs font-mono space-y-1.5">
            {[
              { label: "Run 1:", color: "#fbbf24", text: "ResearchAgent makes unsupported claim. Score: 74. ResearchAgent −4 rep." },
              { label: "Run 2:", color: "#00ff88", text: "Market pairs Research + SourceVerifier. Score: 91. Factuality +26." },
              { label: "Run 3:", color: "#ef4444", text: "Market over-rotates on SkepticAgent. Pitch becomes risk lecture. Score: 85." },
              { label: "Run 4:", color: "#22d3ee", text: "Balanced swarm: PitchAgent leads, SkepticAgent supports. Score: 96." },
            ].map(({ label, color, text }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="w-12 flex-shrink-0 font-bold" style={{ color }}>{label}</span>
                <span className="text-slate-500">{text}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-900">
            <span className="text-xs text-slate-700">{mission.length} chars</span>
            <div className="flex gap-2">
              {displayResult && (
                <button onClick={runDemo} disabled={loading || fastDemoActive}
                  className="px-5 py-2 text-xs font-black border border-blue-500/50 text-blue-400 rounded hover:bg-blue-500/10 transition-all disabled:opacity-50">
                  ↺ RUN AGAIN
                </button>
              )}
              <button onClick={runFastDemo} disabled={loading || fastDemoActive}
                className="px-5 py-2 text-xs font-black border border-purple-500/50 text-purple-400 rounded hover:bg-purple-500/10 transition-all disabled:opacity-50">
                {fastDemoActive ? `● ${runCount}/4 RUNNING...` : "⚡ AUTO DEMO (4 RUNS)"}
              </button>
              <button onClick={runDemo} disabled={loading || fastDemoActive}
                className="px-6 py-2 text-xs font-black bg-green-500 text-black rounded hover:bg-green-400 transition-all disabled:opacity-50 glow-green">
                {loading ? "● RUNNING..." : "⚡ RUN MARKET"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded border border-red-900/50 bg-red-950/20 text-xs text-red-400 font-mono">Error: {error}</div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Left: Agent cards */}
          <div className="lg:col-span-1">
            <div className="terminal-card p-4">
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">Agent Registry</div>
              <div className="space-y-2">
                {liveAgents.map((agent, i) => (
                  <AgentCard key={agent.id} agent={agent} bid={bidsByAgent[agent.id]} delay={i * 0.04} />
                ))}
              </div>
            </div>
          </div>

          {/* Center: auction + messages + output + math */}
          <div className="lg:col-span-1 xl:col-span-2 space-y-4">
            {displayResult && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">⚖️ Agent Auction — Vickrey-Inspired</div>
                <AuctionLog bids={displayResult.bids} />
              </div>
            )}

            {/* Agent message feed */}
            {liveMessages.length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
                  💬 Agent Message Bus
                  <span className="ml-2 text-slate-800">run #{displayResult?.runNumber ?? runCount}</span>
                </div>
                <MessageFeed messages={liveMessages} />
              </div>
            )}

            {displayResult && (
              <div className="terminal-card p-4" ref={outputRef}>
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
                  📋 Final Output — Run #{displayResult.runNumber}
                </div>
                <OutputPanel result={displayResult} />
              </div>
            )}

            {displayResult && showMath && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">🧮 Math Engine Snapshot</div>
                <MathPanel snapshot={displayResult.mathSnapshot} showMath={showMath} />
              </div>
            )}

            {!displayResult && !loading && (
              <div className="terminal-card p-5">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-4">📊 Expected Outcomes Preview</div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Run 1", value: "74", color: "#fbbf24", note: "factuality gap" },
                    { label: "Run 2", value: "91", color: "#00ff88", note: "market learned" },
                    { label: "Run 3", value: "85", color: "#ef4444", note: "over-rotation ↓" },
                    { label: "Run 4", value: "96", color: "#22d3ee", note: "calibrated peak" },
                  ].map((s) => (
                    <div key={s.label} className="p-2 rounded border text-center" style={{ borderColor: `${s.color}30`, backgroundColor: `${s.color}05` }}>
                      <div className="text-xs text-slate-600 mb-1">{s.label}</div>
                      <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.note}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {[
                    { label: "Factuality gain", value: "+26 pts", color: "#00ff88" },
                    { label: "Risk reduction", value: "−23%", color: "#00aaff" },
                    { label: "Swarm objective", value: "0.61→0.94", color: "#a855f7" },
                    { label: "Regression demo", value: "91→85→96", color: "#ef4444" },
                    { label: "PitchAgent φ", value: "+21.4", color: "#22d3ee" },
                    { label: "Arc length", value: "4 runs", color: "#fbbf24" },
                  ].map((m) => (
                    <div key={m.label} className="p-2 rounded border border-slate-900 bg-black/40">
                      <div className="text-slate-700 mb-0.5">{m.label}</div>
                      <div className="font-bold" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center text-xs text-slate-700">
                  ↑ click ⚡ RUN MARKET for step-by-step &nbsp;·&nbsp; ⚡ AUTO DEMO for the full arc instantly
                </div>
              </div>
            )}

            {loading && (
              <div className="terminal-card p-8 text-center">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-green-400 text-sm mb-2">
                  ● {PHASE_LABELS[phase]}
                </motion.div>
                <div className="text-slate-600 text-xs">Agents are running...</div>
              </div>
            )}
          </div>

          {/* Right: trust graph + leaderboard + eval + rep + shapley */}
          <div className="lg:col-span-1 space-y-4">
            {/* Trust graph — always visible */}
            <div className="terminal-card p-4">
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-2">
                🕸 Agent Trust Network
                {displayResult && <span className="ml-2 text-slate-800">run {displayResult.runNumber}</span>}
              </div>
              <TrustGraph result={displayResult ?? null} agents={liveAgents} />
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-mono">
                {[
                  { color: "#00aaff", label: "fact-check" },
                  { color: "#f472b6", label: "narrative" },
                  { color: "#fbbf24", label: "risk-balance" },
                  { color: "#ef4444", label: "conflict" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1 text-slate-700">
                    <span className="w-2 h-0.5 inline-block rounded" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="terminal-card p-4">
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">⭐ Reputation Leaderboard</div>
              <Leaderboard agents={liveAgents} />
            </div>

            {displayResult && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">📊 Eval Score</div>
                <ScorePanel score={displayResult.evalScore} runNum={displayResult.runNumber} improvement={displayResult.improvementFromPrevious} />
              </div>
            )}

            {displayResult && displayResult.reputationChanges.length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">📈 Reputation Updates</div>
                <ReputationLog changes={displayResult.reputationChanges} />
              </div>
            )}

            {displayResult && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">⚡ Contribution Ledger (Shapley)</div>
                <ContributionLedger contributions={displayResult.shapleyContributions} />
              </div>
            )}

            <div className="terminal-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-600 uppercase tracking-wider">🔭 W&B Weave Traces</span>
                {tracesLoading && (
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}
                    className="text-xs font-mono text-purple-600">fetching…</motion.span>
                )}
                {!tracesLoading && traceSummary && (
                  <button onClick={() => void fetchTraces()} className="ml-auto text-xs text-slate-700 hover:text-slate-500 transition-colors">↺</button>
                )}
              </div>
              <WeaveTracePanel traces={traceSummary} loading={tracesLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
