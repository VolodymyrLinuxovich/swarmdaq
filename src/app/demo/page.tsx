"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useCopilotReadable } from "@copilotkit/react-core";
import type { MissionResult, Agent, AgentBid, ReputationChange, ShapleyContribution, AgentMessage, MarketDecisionEntry, StreamEvent, EvalScore, DeliberationEntry, DeliberationRevision } from "@/lib/types";
import { AGENT_PROVIDER, PROVIDER_COLORS } from "@/lib/providers-config";
import type { TraceSummary } from "@/app/api/traces/route";
import { getAgentLabel } from "@/components/copilot/WeakAgentCard";
import type { MissionSummary, MarketFeedEvent, MissionEvent } from "@/lib/marketHistory";
import type { MarketIntelligenceResponse } from "@/app/api/market/intelligence/route";

const DEFAULT_MISSION =
  "Route this mission through the SwarmDAQ agent market: build a demo-ready hackathon launch plan for a student AI product. Show every auction decision, agent failure, evaluator score, and reputation update. Deliver a concise final launch artifact.";

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

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^---+$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toBullets(text: string, max = 5): string[] {
  const clean = stripMarkdown(text);
  const lines = clean.split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter((l) => l.length > 12);
  if (lines.length >= 2) return lines.slice(0, max);
  return clean.split(/\.\s+/).filter((s) => s.trim().length > 12).slice(0, max).map((s) => s.trim() + (s.trim().endsWith(".") ? "" : "."));
}

// ── Components ───────────────────────────────────────────────────────────────

function AgentCard({ agent, bid, delay = 0, isActive = false }: { agent: Agent; bid?: AgentBid; delay?: number; isActive?: boolean }) {
  const color = STATUS_COLOR[agent.status] ?? "#475569";
  const isRunning = agent.status === "running";
  const isSelected = ["selected", "running", "done", "promoted", "penalized"].includes(agent.status);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`p-3 rounded border transition-all ${isRunning ? "agent-running" : ""}`}
      style={{
        borderColor: isActive ? "#00ff88" : isSelected ? `${color}60` : "#1e293b",
        backgroundColor: isActive ? "rgba(0,255,136,0.06)" : isSelected ? `${color}08` : "#050505",
        boxShadow: isActive ? "0 0 12px rgba(0,255,136,0.15)" : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="text-xs font-bold text-slate-200">{agent.name}</span>
          {agent.provider && agent.provider !== "gemini" && (
            <span className="text-xs font-mono px-1 rounded"
              style={{ color: agent.provider === "anthropic" ? "#f97316" : "#00ff88", backgroundColor: agent.provider === "anthropic" ? "rgba(249,115,22,0.1)" : "rgba(0,255,136,0.08)", border: `1px solid ${agent.provider === "anthropic" ? "rgba(249,115,22,0.3)" : "rgba(0,255,136,0.2)"}` }}>
              {agent.provider === "anthropic" ? "claude" : "gpt-4o"}
            </span>
          )}
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

function ScorePanel({ score, runNum, improvement, runCost, weaveTraceUrl }: {
  score: MissionResult["evalScore"]; runNum: number; improvement?: MissionResult["improvementFromPrevious"];
  runCost?: MissionResult["runCost"]; weaveTraceUrl?: string;
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
        {runCost && (
          <div className="flex items-center gap-2 ml-1">
            <span className="text-xs font-mono text-amber-500/80">${runCost.totalUSD.toFixed(5)}</span>
            <span className="text-slate-800 text-xs">·</span>
            <span className="text-xs font-mono text-slate-600">{(runCost.inputTokens + runCost.outputTokens).toLocaleString()} tok</span>
          </div>
        )}
        {weaveTraceUrl && (
          <a href={weaveTraceUrl} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs font-mono text-purple-600 hover:text-purple-400 transition-colors flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500/60 inline-block" />
            traces ↗
          </a>
        )}
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

function PitchSegment({ text }: { text: string }) {
  const segments = text.split(/(\[\d+-?\d*s\])/).filter(Boolean);
  const parts: Array<{ time: string | null; body: string }> = [];
  let cur: { time: string | null; body: string } = { time: null, body: "" };
  for (const seg of segments) {
    if (/^\[\d+-?\d*s\]$/.test(seg)) {
      if (cur.body.trim()) parts.push(cur);
      cur = { time: seg, body: "" };
    } else {
      cur.body += seg;
    }
  }
  if (cur.body.trim()) parts.push(cur);
  if (parts.length === 0) return <div className="text-xs font-mono text-slate-400 leading-relaxed whitespace-pre-wrap">{text}</div>;
  return (
    <div className="space-y-3">
      {parts.map((p, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
          className="flex gap-3 p-3 rounded border border-slate-900 bg-slate-950/40">
          {p.time && (
            <span className="text-xs font-bold font-mono text-amber-500/80 flex-shrink-0 mt-0.5 w-14">{p.time}</span>
          )}
          <p className="text-xs text-slate-300 leading-relaxed flex-1">{p.body.trim().replace(/^"/, "").replace(/"$/, "")}</p>
        </motion.div>
      ))}
    </div>
  );
}

function RiskCard({ text }: { text: string }) {
  const lines = toBullets(text, 6);
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const isCritical = /critical|high|major/i.test(line);
        const color = isCritical ? "#ef4444" : "#fbbf24";
        return (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
            className="p-3 rounded border text-xs font-mono leading-relaxed"
            style={{ borderColor: `${color}25`, backgroundColor: `${color}05` }}>
            <span style={{ color: "#94a3b8" }}>{line}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function OutputPanel({ result }: { result: MissionResult }) {
  const [tab, setTab] = useState<"pitch" | "positioning" | "risks">("pitch");
  const [copied, setCopied] = useState(false);
  const copyPitch = () => { navigator.clipboard.writeText(result.output.pitch); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const runColor = result.runNumber >= 4 ? "#22d3ee" : result.runNumber === 3 ? "#ef4444" : result.runNumber === 2 ? "#00ff88" : "#fbbf24";
  return (
    <div>
      {/* Landing headline — always visible */}
      <div className="mb-4 p-3 rounded border bg-gradient-to-r from-slate-950 to-black"
        style={{ borderColor: `${runColor}30` }}>
        <div className="text-xs text-slate-600 font-mono mb-1 uppercase tracking-wider">Landing headline</div>
        <div className="text-base font-bold leading-snug" style={{ color: runColor }}>{result.output.landingHeadline}</div>
      </div>

      <div className="flex gap-2 mb-3">
        {(["pitch", "positioning", "risks"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className="px-3 py-1 text-xs font-mono rounded border transition-colors"
            style={{ borderColor: tab === t ? "#00ff88" : "#1e293b", color: tab === t ? "#00ff88" : "#475569", backgroundColor: tab === t ? "rgba(0,255,136,0.05)" : "transparent" }}>
            {t}
          </button>
        ))}
        {tab === "pitch" && (
          <button onClick={copyPitch} className="ml-auto px-3 py-1 text-xs font-mono rounded border border-slate-700 text-slate-400 hover:border-green-600 hover:text-green-400 transition-colors">
            {copied ? "✓ copied" : "copy"}
          </button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto pr-1">
        {tab === "pitch" && <PitchSegment text={result.output.pitch} />}
        {tab === "positioning" && (
          <div className="space-y-2">
            {toBullets(result.output.positioning, 6).map((bullet, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="flex items-start gap-2 p-2 rounded border border-slate-900 bg-slate-950/40 text-xs font-mono text-slate-300">
                <span className="text-green-500 flex-shrink-0 mt-0.5">▸</span>
                <span className="leading-relaxed">{bullet}</span>
              </motion.div>
            ))}
          </div>
        )}
        {tab === "risks" && <RiskCard text={result.output.risks.join("\n")} />}
      </div>
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
                {r.runCost && <div className="text-xs font-mono text-amber-600/70 mt-0.5">${r.runCost.totalUSD.toFixed(5)}</div>}
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

// ── NEW: MarketMaker Decision Log ────────────────────────────────────────────

function MarketDecisionLog({ log }: { log: MarketDecisionEntry[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!log.length) return <div className="text-xs font-mono text-slate-800">no live run yet</div>;
  return (
    <div className="space-y-1.5">
      {log.map((entry) => (
        <div key={entry.taskType} className="border border-slate-900 rounded">
          <button
            onClick={() => setOpen(open === entry.taskType ? null : entry.taskType)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-left hover:bg-slate-950/60 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/70 flex-shrink-0" />
            <span className="text-slate-600 flex-1">{entry.taskType.replace(/_/g, " ")}</span>
            <span className="text-green-400 font-bold">{entry.winnerName}</span>
            <span className="text-slate-700 ml-1">{open === entry.taskType ? "▲" : "▼"}</span>
          </button>
          {open === entry.taskType && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-3 pb-3 space-y-1.5 border-t border-slate-900">
              <div className="text-xs text-slate-700 pt-2 mb-2 uppercase tracking-wider">all candidates</div>
              {entry.candidates.map((c, i) => (
                <div key={c.agentId} className="text-xs font-mono space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-slate-700">{i + 1}.</span>
                    <span className={i === 0 ? "text-green-400 font-bold" : "text-slate-500"}>{c.agentName}</span>
                    {(() => { const p = AGENT_PROVIDER[c.agentId]; return p && p !== "gemini" ? <span className="text-xs px-1 rounded" style={{ color: PROVIDER_COLORS[p], backgroundColor: `${PROVIDER_COLORS[p]}18`, border: `1px solid ${PROVIDER_COLORS[p]}40` }}>{p === "anthropic" ? "claude" : "gpt-4o"}</span> : null; })()}
                    <span className="ml-auto font-bold" style={{ color: i === 0 ? "#00ff88" : "#475569" }}>{c.compositeScore.toFixed(4)}</span>
                  </div>
                  <div className="flex gap-3 pl-6 text-slate-800">
                    <span>skill {c.skillMatch.toFixed(2)}</span>
                    <span>bayes {c.bayesianMean.toFixed(2)}</span>
                    <span>ucb {c.ucb.toFixed(2)}</span>
                    <span>trust {c.graphTrust.toFixed(2)}</span>
                  </div>
                  {c.priceAnomaly && (
                    <div className="pl-6 flex flex-wrap gap-2 text-slate-700">
                      <span className="text-amber-500">{c.priceAnomaly.label.replace(/_/g, " ")}</span>
                      <span>pct {c.priceAnomaly.percentile ?? "n/a"}</span>
                      <span>p {c.priceAnomaly.pValue ?? "n/a"}</span>
                      {c.priceAnomaly.explanation?.riskLevel && (
                        <span className={c.priceAnomaly.explanation.riskLevel === "high" ? "text-red-500" : c.priceAnomaly.explanation.riskLevel === "medium" ? "text-amber-500" : "text-green-500"}>
                          {c.priceAnomaly.explanation.riskLevel} risk
                        </span>
                      )}
                    </div>
                  )}
                  {c.priceAnomaly?.explanation?.judgeFriendlyExplanation && (
                    <div className="pl-6 text-slate-600 leading-relaxed">
                      {c.priceAnomaly.explanation.judgeFriendlyExplanation}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </div>
      ))}
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
            {traces.latencyP50Ms !== undefined && (
              <>
                <span className="text-slate-700">p50 latency</span>
                <span className="text-slate-500">{traces.latencyP50Ms}ms</span>
                <span className="text-slate-700">p95 latency</span>
                <span className="text-slate-500">{traces.latencyP95Ms}ms</span>
              </>
            )}
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

function MarketIntelligencePanel({ intelligence }: { intelligence: MarketIntelligenceResponse | null }) {
  const anomaly = intelligence?.recentAnomalies[0];
  const statusColor = intelligence?.redisEnabled ? "#00ff88" : "#fbbf24";
  const tdigestColor = intelligence?.tdigestEnabled ? "#22d3ee" : intelligence?.redisEnabled ? "#fbbf24" : "#64748b";
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs font-mono">
        <div className="border border-slate-900 rounded p-2">
          <div className="text-slate-700 uppercase tracking-wider">Market Memory</div>
          <div className="font-bold mt-1" style={{ color: statusColor }}>
            Redis {intelligence?.redisEnabled ? "Enabled" : "Fallback"}
          </div>
        </div>
        <div className="border border-slate-900 rounded p-2">
          <div className="text-slate-700 uppercase tracking-wider">Market Events</div>
          <div className="font-bold mt-1 text-green-400">{intelligence?.totalEvents ?? 0}</div>
        </div>
        <div className="border border-slate-900 rounded p-2">
          <div className="text-slate-700 uppercase tracking-wider">t-digest</div>
          <div className="font-bold mt-1" style={{ color: tdigestColor }}>
            {intelligence?.tdigestMode ?? "loading"}
          </div>
        </div>
        <div className="border border-slate-900 rounded p-2">
          <div className="text-slate-700 uppercase tracking-wider">Price p95</div>
          <div className="font-bold mt-1 text-amber-400">
            {intelligence?.globalPriceStats ? `$${intelligence.globalPriceStats.p95.toFixed(3)}` : "--"}
          </div>
        </div>
      </div>

      {intelligence?.topAgentsByReputation.length ? (
        <div className="mb-3">
          <div className="text-xs text-slate-700 uppercase tracking-wider mb-1">Redis Leaderboard Snapshot</div>
          <div className="space-y-1">
            {intelligence.topAgentsByReputation.slice(0, 3).map((agent, i) => (
              <div key={agent.id} className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-700 w-4">{i + 1}</span>
                <span className="flex-1 text-slate-500 truncate">{agent.name}</span>
                <span className="text-green-400">{agent.reputation}</span>
                <span className="text-slate-700">elo</span>
                <span className="text-blue-400">{agent.elo}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {anomaly ? (
        <div className="border-t border-slate-900 pt-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-slate-700 uppercase tracking-wider">Latest Anomaly</span>
            <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded border border-amber-900/50 text-amber-400">
              p={anomaly.pValue ?? "n/a"}
            </span>
          </div>
          <div className="text-xs font-bold text-fuchsia-400 mb-1">{anomaly.label.replace(/_/g, " ")}</div>
          <div className="text-xs text-slate-500 leading-relaxed">
            {anomaly.explanation ?? `${anomaly.agentName} bid $${anomaly.price.toFixed(3)} at percentile ${anomaly.percentile ?? "unknown"}.`}
          </div>
        </div>
      ) : (
        <div className="text-xs font-mono text-slate-800">no price anomalies yet — run more market cycles</div>
      )}
    </div>
  );
}

// ── Comparison View ──────────────────────────────────────────────────────────

function ComparisonView({ run1, run4 }: { run1: MissionResult; run4: MissionResult }) {
  const r1Segs = run1.output.pitch.split(/(\[\d+-?\d*s\])/).filter(Boolean);
  const r4Segs = run4.output.pitch.split(/(\[\d+-?\d*s\])/).filter(Boolean);
  const makeParts = (segs: string[]) => {
    const parts: Array<{ time: string; body: string }> = [];
    let cur = { time: "", body: "" };
    for (const s of segs) {
      if (/^\[\d+-?\d*s\]$/.test(s)) { if (cur.body.trim()) parts.push(cur); cur = { time: s, body: "" }; }
      else cur.body += s;
    }
    if (cur.body.trim()) parts.push(cur);
    return parts;
  };
  const p1 = makeParts(r1Segs);
  const p4 = makeParts(r4Segs);
  const len = Math.max(p1.length, p4.length);

  return (
    <div>
      {/* Headline comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded border border-amber-500/20 bg-amber-950/10">
          <div className="text-xs text-amber-500/60 font-mono mb-1">Run 1 headline · score 74</div>
          <div className="text-sm font-bold text-amber-400 leading-snug">{run1.output.landingHeadline}</div>
        </div>
        <div className="p-3 rounded border border-cyan-500/20 bg-cyan-950/10">
          <div className="text-xs text-cyan-500/60 font-mono mb-1">Run 4 headline · score 96</div>
          <div className="text-sm font-bold text-cyan-400 leading-snug">{run4.output.landingHeadline}</div>
        </div>
      </div>
      {/* Pitch segment comparison */}
      <div className="text-xs text-slate-600 uppercase tracking-wider mb-2">90-second pitch · segment by segment</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Array.from({ length: len }).map((_, i) => {
          const s1 = p1[i];
          const s4 = p4[i];
          return (
            <div key={i} className="contents">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
                className="p-2.5 rounded border text-xs font-mono" style={{ borderColor: "rgba(251,191,36,0.15)", backgroundColor: "rgba(251,191,36,0.03)" }}>
                {s1 ? <><span className="text-amber-500/60 block mb-1">{s1.time}</span><span className="text-slate-500 leading-relaxed">{s1.body.trim()}</span></> : null}
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 + 0.04 }}
                className="p-2.5 rounded border text-xs font-mono" style={{ borderColor: "rgba(34,211,238,0.15)", backgroundColor: "rgba(34,211,238,0.03)" }}>
                {s4 ? <><span className="text-cyan-500/60 block mb-1">{s4.time}</span><span className="text-slate-300 leading-relaxed">{s4.body.trim()}</span></> : null}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Live Agent Ticker ─────────────────────────────────────────────────────────

const TICKER_STATIC = [
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

function LiveTicker({ agents, reputationChanges }: { agents: Agent[]; reputationChanges?: MissionResult["reputationChanges"] }) {
  const labelColors: Record<string, string> = { BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff" };

  const source = agents.length
    ? agents.map((a) => {
        const label = getAgentLabel(a);
        const change = reputationChanges?.find((c) => c.agentId === a.id);
        const delta = change && change.delta !== 0
          ? (change.delta > 0 ? `▲ +${change.delta}` : `▼ ${change.delta}`)
          : "─ live";
        return { text: a.name.replace("Agent", ""), delta, color: labelColors[label] ?? "#475569", label };
      })
    : TICKER_STATIC;

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

// ── Deliberation Feed ─────────────────────────────────────────────────────────

function DeliberationFeed({ entries, revisions, done }: {
  entries: DeliberationEntry[];
  revisions: DeliberationRevision[];
  done: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [entries.length, revisions.length]);

  if (entries.length === 0 && revisions.length === 0) return null;

  const objCount = entries.filter((e) => e.kind === "objection").length;
  const endCount = entries.filter((e) => e.kind === "endorsement").length;

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
      {entries.map((e, i) => {
        const isObj = e.kind === "objection";
        const isCritical = isObj && e.severity === "critical";
        const color = isCritical ? "#ef4444" : isObj ? "#f97316" : "#00ff88";
        const icon = isCritical ? "⚠" : isObj ? "○" : "✓";
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}
            className="flex gap-2 p-2.5 rounded border text-xs font-mono"
            style={{ borderColor: `${color}25`, backgroundColor: `${color}06` }}>
            <span className="flex-shrink-0 w-4 font-bold" style={{ color }}>{icon}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="font-bold" style={{ color }}>{e.criticName}</span>
                <span className="text-slate-700">→</span>
                <span className="text-slate-400">{e.targetAgentName}</span>
                <span className="text-slate-800 text-xs px-1 rounded border border-slate-900">{e.taskType.replace(/_/g, " ")}</span>
                {isCritical && <span className="text-red-500 text-xs font-bold">CRITICAL</span>}
              </div>
              <p className="text-slate-400 leading-relaxed">{e.claim}</p>
            </div>
          </motion.div>
        );
      })}
      {revisions.map((r, i) => (
        <motion.div key={`rev-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}
          className="flex gap-2 p-2.5 rounded border border-blue-900/30 bg-blue-950/10 text-xs font-mono">
          <span className="flex-shrink-0 w-4 text-blue-400 font-bold">↺</span>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-bold text-blue-400">{r.agentName}</span>
              <span className="text-slate-700">revised</span>
              <span className="text-slate-800 text-xs px-1 rounded border border-slate-900">{r.taskType.replace(/_/g, " ")}</span>
            </div>
            <p className="text-slate-500 leading-relaxed">{r.summary}</p>
          </div>
        </motion.div>
      ))}
      {done && entries.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 pt-1 pb-0.5 text-xs font-mono text-slate-700">
          <span className="text-red-500">{objCount} objection{objCount !== 1 ? "s" : ""}</span>
          <span>·</span>
          <span className="text-green-500">{endCount} endorsement{endCount !== 1 ? "s" : ""}</span>
          {revisions.length > 0 && <><span>·</span><span className="text-blue-400">{revisions.length} revision{revisions.length !== 1 ? "s" : ""}</span></>}
        </motion.div>
      )}
      <div ref={endRef} />
    </div>
  );
}

// ── Agent Studio ──────────────────────────────────────────────────────────────

const STUDIO_SKILLS = [
  "research", "market_analysis", "competitive_intel", "data_synthesis",
  "fact_checking", "source_validation", "skepticism", "risk_assessment",
  "pitch", "narrative", "copywriting", "storytelling",
  "product_design", "ux_analysis", "positioning", "go_to_market",
  "evaluation", "scoring", "analysis", "strategy",
  "planning", "coordination", "financial_modeling", "technical_review",
];

const STUDIO_PROVIDERS: Array<{ value: "gemini" | "openai" | "anthropic"; label: string; color: string }> = [
  { value: "gemini", label: "Gemini 2.5 Flash", color: "#00aaff" },
  { value: "openai", label: "GPT-4o", color: "#00ff88" },
  { value: "anthropic", label: "Claude Sonnet", color: "#f97316" },
];

function AgentStudioModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [provider, setProvider] = useState<"gemini" | "openai" | "anthropic">("gemini");
  const [reputation, setReputation] = useState(70);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSkill = (s: string) =>
    setSkills((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : prev.length < 6 ? [...prev, s] : prev);

  const submit = async () => {
    if (!name.trim() || !role.trim() || skills.length === 0) {
      setError("name, role, and at least one skill required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: role.trim(), skills, provider, reputation }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "failed"); return; }
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="w-full max-w-lg border border-green-900/40 rounded bg-black p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-green-400">Agent Studio</div>
            <div className="text-xs text-slate-600 mt-0.5">Deploy a custom agent into the live market</div>
          </div>
          <button onClick={onClose} className="text-slate-700 hover:text-slate-400 text-lg leading-none">×</button>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-slate-600 uppercase tracking-wider block mb-1">Agent Name</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. DataScienceAgent"
            maxLength={40}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-base sm:text-sm text-slate-200 placeholder-slate-700 outline-none focus:border-green-700 transition-colors font-mono"
          />
        </div>

        {/* Role */}
        <div>
          <label className="text-xs text-slate-600 uppercase tracking-wider block mb-1">Role / Expertise</label>
          <input
            value={role} onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Specializes in data-driven market sizing and TAM analysis"
            maxLength={120}
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-base sm:text-sm text-slate-200 placeholder-slate-700 outline-none focus:border-green-700 transition-colors font-mono"
          />
        </div>

        {/* Skills */}
        <div>
          <label className="text-xs text-slate-600 uppercase tracking-wider block mb-2">
            Skills <span className="text-slate-700">({skills.length}/6 selected)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_SKILLS.map((s) => {
              const active = skills.includes(s);
              return (
                <button key={s} onClick={() => toggleSkill(s)}
                  className="px-2 py-1 rounded text-xs font-mono transition-colors"
                  style={{
                    borderWidth: 1, borderStyle: "solid",
                    borderColor: active ? "#00ff88" : "#1e293b",
                    color: active ? "#00ff88" : "#475569",
                    backgroundColor: active ? "rgba(0,255,136,0.08)" : "transparent",
                  }}>
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Provider */}
        <div>
          <label className="text-xs text-slate-600 uppercase tracking-wider block mb-2">LLM Provider</label>
          <div className="flex gap-2">
            {STUDIO_PROVIDERS.map((p) => (
              <button key={p.value} onClick={() => setProvider(p.value)}
                className="flex-1 py-2 rounded border text-xs font-mono transition-colors"
                style={{
                  borderColor: provider === p.value ? p.color : "#1e293b",
                  color: provider === p.value ? p.color : "#475569",
                  backgroundColor: provider === p.value ? `${p.color}10` : "transparent",
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Starting reputation */}
        <div>
          <label className="text-xs text-slate-600 uppercase tracking-wider block mb-2">
            Starting Reputation <span className="text-green-500 font-bold">{reputation}</span>
            <span className="text-slate-700 ml-2">(50–82, market will adjust)</span>
          </label>
          <input type="range" min={50} max={82} value={reputation}
            onChange={(e) => setReputation(Number(e.target.value))}
            className="w-full accent-green-500" />
          <div className="flex justify-between text-xs text-slate-700 mt-0.5">
            <span>50 · WATCH</span><span>66 · HOLD</span><span>82 · BUY candidate</span>
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 font-mono border border-red-900/40 rounded px-3 py-2">{error}</div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-mono border border-slate-800 text-slate-500 rounded hover:border-slate-600 transition-colors">
            cancel
          </button>
          <button onClick={() => void submit()} disabled={submitting}
            className="flex-1 py-2 text-xs font-black bg-green-500 text-black rounded hover:bg-green-400 disabled:opacity-50 transition-colors">
            {submitting ? "deploying…" : "⚡ Deploy Agent"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Page types ───────────────────────────────────────────────────────────────

type Phase = "idle" | "planning" | "auction" | "executing" | "deliberating" | "evaluating" | "updating" | "done";
const PHASE_LABELS: Record<Phase, string> = {
  idle: "Waiting", planning: "Planning →", auction: "Auction →",
  executing: "Executing →", deliberating: "Deliberating →", evaluating: "Evaluating →", updating: "Updating Reputation →", done: "Complete ✓",
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
  const [sessionCost, setSessionCost] = useState(0);
  const [streamBids, setStreamBids] = useState<AgentBid[]>([]);
  const [streamDecisionLog, setStreamDecisionLog] = useState<MarketDecisionEntry[]>([]);
  const [streamOutputs, setStreamOutputs] = useState<Record<string, string>>({});
  const [streamScore, setStreamScore] = useState<EvalScore | null>(null);
  const [streamRepChanges, setStreamRepChanges] = useState<ReputationChange[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [recentMissions, setRecentMissions] = useState<MissionSummary[]>([]);
  const [totalMissions, setTotalMissions] = useState(0);
  const [marketFeed, setMarketFeed] = useState<MarketFeedEvent[]>([]);
  const [replayMissionId, setReplayMissionId] = useState<string | null>(null);
  const [replayMission, setReplayMission] = useState<MissionResult | null>(null);
  const [replayEvents, setReplayEvents] = useState<MissionEvent[]>([]);
  const [marketIntelligence, setMarketIntelligence] = useState<MarketIntelligenceResponse | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [deliberationEntries, setDeliberationEntries] = useState<DeliberationEntry[]>([]);
  const [deliberationRevisions, setDeliberationRevisions] = useState<DeliberationRevision[]>([]);
  const [deliberationDone, setDeliberationDone] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const [judgeMode, setJudgeMode] = useState(false);

  const deleteCustomAgent = async (agentId: string) => {
    try {
      await fetch(`/api/agents/custom/${agentId}`, { method: "DELETE" });
      await fetchAgentsRef.current();
    } catch {}
  };

  // ── Expose state to CopilotKit ──────────────────────────────────────────
  useCopilotReadable({
    description: "Live SwarmDAQ agent registry with current reputation, Elo, Bayesian mean, uncertainty, and market labels",
    value: liveAgents,
  });
  useCopilotReadable({
    description: "Last completed mission result including swarm selection, bids, evaluation scores, reputation changes, and improvement data",
    value: result,
  });
  useCopilotReadable({
    description: "Demo session state",
    value: { runCount, sessionCost, currentMission: mission, phase, fastDemoResults: fastDemoResults.map((r) => ({ runNumber: r.runNumber, overall: r.evalScore.overall })) },
  });
  useCopilotReadable({
    description: "Redis-powered market intelligence: event stream totals, t-digest status, price percentiles, top agents, and latest anomalies",
    value: marketIntelligence,
  });

  const fetchTraces = async () => {
    setTracesLoading(true);
    try {
      const res = await fetch("/api/traces");
      if (res.ok) setTraceSummary(await res.json());
    } catch {}
    setTracesLoading(false);
  };

  const fetchMarketMemory = async () => {
    try {
      const [histRes, feedRes, intelRes] = await Promise.all([
        fetch("/api/history?limit=8"),
        fetch("/api/market-feed?limit=12"),
        fetch("/api/market/intelligence"),
      ]);
      if (histRes.ok) {
        const { missions, total } = await histRes.json() as { missions: MissionSummary[]; total: number };
        setRecentMissions(missions);
        setTotalMissions(total);
      }
      if (feedRes.ok) {
        const { events } = await feedRes.json() as { events: MarketFeedEvent[] };
        setMarketFeed(events);
      }
      if (intelRes.ok) {
        setMarketIntelligence(await intelRes.json() as MarketIntelligenceResponse);
      }
    } catch {}
  };

  const selectReplay = async (missionId: string) => {
    if (replayMissionId === missionId) { setReplayMissionId(null); setReplayMission(null); setReplayEvents([]); return; }
    setReplayMissionId(missionId);
    try {
      const res = await fetch(`/api/history/${missionId}`);
      const { mission, events } = await res.json() as { mission: MissionResult; events: MissionEvent[] };
      setReplayMission(mission);
      setReplayEvents(events);
    } catch {}
  };

  const fetchAgentsRef = useRef(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setLiveAgents(data.agents ?? []);
    } catch {}
  });

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchAgentsRef.current(); void fetchMarketMemory(); }, []);

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
    setStreamBids([]);
    setStreamDecisionLog([]);
    setStreamOutputs({});
    setStreamScore(null);
    setStreamRepChanges([]);
    setActiveAgent(null);
    setDeliberationEntries([]);
    setDeliberationRevisions([]);
    setDeliberationDone(false);
    setPhase("planning");

    const handleStreamEvent = (event: StreamEvent) => {
      switch (event.type) {
        case "phase":
          setPhase(event.phase as Phase);
          break;
        case "bid":
          setStreamBids((prev) => [...prev, ...event.bids]);
          setStreamDecisionLog((prev) => [...prev, event.decisionEntry]);
          break;
        case "swarm":
          setLiveAgents((prev) => prev.map((a) => {
            const updated = event.agents.find((x) => x.id === a.id);
            return updated ? { ...a, status: updated.status } : a;
          }));
          break;
        case "agent_start":
          setActiveAgent(event.agentId);
          setLiveAgents((prev) => prev.map((a) => a.id === event.agentId ? { ...a, status: "running" } : a));
          break;
        case "agent_done":
          setActiveAgent(null);
          setLiveAgents((prev) => prev.map((a) => a.id === event.agentId ? { ...a, status: "done" } : a));
          setStreamOutputs((prev) => ({ ...prev, [event.taskType]: event.output }));
          break;
        case "deliberation_start":
          break;
        case "deliberation_entry":
          setDeliberationEntries((prev) => [...prev, event.entry]);
          break;
        case "deliberation_revision":
          setDeliberationRevisions((prev) => [...prev, event.revision]);
          break;
        case "deliberation_done":
          setDeliberationDone(true);
          break;
        case "score":
          setStreamScore(event.evalScore);
          break;
        case "rep_change":
          setLiveAgents((prev) => prev.map((a) => a.id === event.change.agentId
            ? { ...a, status: event.change.delta > 0 ? "promoted" : "penalized" }
            : a));
          setStreamRepChanges((prev) => [...prev, event.change]);
          break;
        case "done": {
          const data = event.result;
          setResult(data);
          setPhase("done");
          setRunCount((c) => c + 1);
          setWeaveCount((c) => c + (data.agentMessages?.length ?? 6));
          if (data.runCost) setSessionCost((c) => c + data.runCost!.totalUSD);
          void animateMessages(data.agentMessages ?? []);
          void fetchAgentsRef.current();
          void fetchTraces();
          void fetchMarketMemory();
          setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
          break;
        }
        case "error":
          setError(event.message);
          setPhase("idle");
          break;
      }
    };

    try {
      await fetchAgentsRef.current();
      const res = await fetch("/api/mission/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission, runNumber: runCount + 1 }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim().split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try { handleStreamEvent(JSON.parse(line.slice(6)) as StreamEvent); } catch {}
        }
      }
    } catch (err) {
      setError(String(err));
      setPhase("idle");
    } finally {
      setLoading(false);
      setActiveAgent(null);
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
        if (data.runCost) setSessionCost((c) => c + data.runCost!.totalUSD);
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
    void fetchMarketMemory();
    setFastDemoActive(false);
  };

  const resetDemo = async () => {
    await fetch("/api/reset-demo", { method: "POST" });
    setResult(null); setPhase("idle"); setRunCount(0);
    setLiveMessages([]); setFastDemoResults([]); setSelectedFastRun(null);
    setWeaveCount(0); setSessionCost(0);
    await fetchAgentsRef.current();
  };

  const bidsByAgent: Record<string, AgentBid> = {};
  if (result) { for (const b of result.bids) { if (b.isWinner) bidsByAgent[b.agentId] = b; } }

  const displayResult = selectedFastRun
    ? fastDemoResults.find((r) => r.runNumber === selectedFastRun) ?? result
    : result;

  // Live stream state falls back to result when complete
  const liveBids = displayResult?.bids ?? streamBids;
  const liveDecisionLog = displayResult?.marketDecisionLog ?? streamDecisionLog;
  const liveRepChanges = displayResult?.reputationChanges ?? streamRepChanges;
  const liveScore = displayResult?.evalScore ?? streamScore;

  return (
    <div className="min-h-screen bg-black grid-bg font-mono">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex flex-wrap items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-sm border-b border-green-900/20 gap-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs neon-green font-black tracking-widest">SWARMDAQ</Link>
          <div className="h-3 w-px bg-slate-700 hidden sm:block" />
          <span className="hidden sm:inline text-xs text-slate-600">live demo terminal</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {sessionCost > 0 && (
            <span className="hidden sm:inline text-xs font-mono text-amber-500/80">
              ${sessionCost.toFixed(5)}
            </span>
          )}
          {weaveCount > 0 && (
            <a href="https://wandb.ai/vborysenko-uc-berkeley/swarmdaq/weave" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono text-purple-500 hover:text-purple-300 transition-colors">
              <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block" />
              <span className="hidden sm:inline">{weaveCount} traces ↗</span>
              <span className="sm:hidden">traces</span>
            </a>
          )}
          <div className="flex items-center gap-1.5 text-xs cursor-pointer select-none" onClick={() => setShowMath((v) => !v)}>
            <div className="w-8 h-4 rounded-full border transition-colors" style={{ borderColor: showMath ? "#00ff88" : "#334155", backgroundColor: showMath ? "rgba(0,255,136,0.2)" : "transparent" }}>
              <div className="w-3 h-3 rounded-full m-0.5 transition-transform" style={{ backgroundColor: showMath ? "#00ff88" : "#475569", transform: showMath ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            <span className="hidden sm:inline text-slate-500">math</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs cursor-pointer select-none" onClick={() => setJudgeMode((v) => !v)}>
            <div className="w-8 h-4 rounded-full border transition-colors" style={{ borderColor: judgeMode ? "#a855f7" : "#334155", backgroundColor: judgeMode ? "rgba(168,85,247,0.2)" : "transparent" }}>
              <div className="w-3 h-3 rounded-full m-0.5 transition-transform" style={{ backgroundColor: judgeMode ? "#a855f7" : "#475569", transform: judgeMode ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            <span className="hidden sm:inline text-slate-500">judge</span>
          </div>
          <Link href="/leaderboard" className="hidden sm:inline text-xs text-slate-600 hover:text-slate-400 transition-colors">leaderboard</Link>
          <Link href="/benchmark" className="hidden md:inline text-xs text-slate-600 hover:text-slate-400 transition-colors">benchmarks</Link>
          <Link href="/architecture" className="hidden md:inline text-xs text-slate-600 hover:text-slate-400 transition-colors">architecture</Link>
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

      {/* Live agent ticker */}
      <LiveTicker agents={liveAgents} reputationChanges={displayResult?.reputationChanges} />

      {/* SwarmDAQ narrative banner */}
      <div className="px-4 py-2 bg-black/80 border-b border-slate-900 flex items-center gap-3 overflow-x-auto">
        <span className="text-xs font-mono text-slate-600 whitespace-nowrap">SwarmDAQ</span>
        <span className="text-slate-800">·</span>
        <span className="text-xs font-mono text-slate-700 whitespace-nowrap">Agents bid on tasks</span>
        <span className="text-slate-800">→</span>
        <span className="text-xs font-mono text-slate-700 whitespace-nowrap">MarketMaker routes using reputation + uncertainty</span>
        <span className="text-slate-800">→</span>
        <span className="text-xs font-mono text-slate-700 whitespace-nowrap">Evaluator scores output</span>
        <span className="text-slate-800">→</span>
        <span className="text-xs font-mono text-slate-700 whitespace-nowrap">ReputationAgent updates future routing</span>
        <span className="text-slate-800">→</span>
        <span className="text-xs font-mono text-green-700 whitespace-nowrap">Redis stores market memory</span>
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
            {runCount > 0 && (
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-slate-600 font-mono">run #{runCount + 1} ready</span>
                <button onClick={resetDemo} className="text-xs font-mono text-slate-700 hover:text-slate-400 transition-colors border border-slate-800 hover:border-slate-600 px-2 py-0.5 rounded">
                  ↺ fresh start
                </button>
              </div>
            )}
          </div>
          <textarea value={mission} onChange={(e) => setMission(e.target.value)} rows={3}
            className="w-full bg-transparent text-base sm:text-sm text-slate-300 resize-none outline-none placeholder-slate-700 leading-relaxed"
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
          <div className="flex flex-wrap items-center justify-between mt-3 pt-3 border-t border-slate-900 gap-2">
            <span className="text-xs text-slate-700">{mission.length} chars</span>
            <div className="flex flex-wrap gap-2">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Left: Agent cards */}
          <div className="md:col-span-1 lg:col-span-1">
            <div className="terminal-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-600 uppercase tracking-wider">Agent Registry</span>
                <button
                  onClick={() => setStudioOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-green-900/50 text-xs font-mono text-green-700 hover:text-green-400 hover:border-green-600 transition-colors"
                >
                  + Studio
                </button>
              </div>
              <div className="space-y-2">
                {liveAgents.map((agent, i) => (
                  <div key={agent.id} className="relative group">
                    <AgentCard agent={agent} bid={bidsByAgent[agent.id]} delay={i * 0.04} isActive={activeAgent === agent.id} />
                    {agent.id.startsWith("custom_") && (
                      <button
                        onClick={() => void deleteCustomAgent(agent.id)}
                        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded text-slate-700 hover:text-red-400 hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center: auction + messages + output + math */}
          <div className="md:col-span-1 lg:col-span-1 xl:col-span-2 space-y-4">
            {liveBids.length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">⚖️ Agent Auction — Vickrey-Inspired</div>
                <AuctionLog bids={liveBids} />
              </div>
            )}

            {liveDecisionLog.length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">🧠 MarketMaker Decision Log</div>
                <MarketDecisionLog log={liveDecisionLog} />
              </div>
            )}

            {/* Live agent output stream — shown while streaming, before final result */}
            {!judgeMode && !displayResult && Object.keys(streamOutputs).length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
                  ⚡ Live Agent Outputs
                  {activeAgent && (
                    <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity }}
                      className="ml-2 text-green-400">● {activeAgent} running…</motion.span>
                  )}
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {Object.entries(streamOutputs).map(([taskType, output]) => (
                    <motion.div key={taskType} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="border border-slate-900 rounded p-3">
                      <div className="text-xs font-mono text-slate-600 uppercase tracking-wider mb-1">{taskType.replace(/_/g, " ")}</div>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{output}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent message feed */}
            {!judgeMode && liveMessages.length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
                  💬 Agent Message Bus
                  <span className="ml-2 text-slate-800">run #{displayResult?.runNumber ?? runCount}</span>
                </div>
                <MessageFeed messages={liveMessages} />
              </div>
            )}

            {/* Deliberation feed */}
            {!judgeMode && (deliberationEntries.length > 0 || deliberationRevisions.length > 0) && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="terminal-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-slate-600 uppercase tracking-wider">⚖ Agent Deliberation</span>
                  {!deliberationDone && (
                    <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity }}
                      className="text-xs font-mono text-amber-500">● live</motion.span>
                  )}
                  {deliberationDone && displayResult && (
                    <span className="ml-auto text-xs font-mono text-green-600">
                      score after deliberation: <span className="font-bold">{displayResult.evalScore.overall}</span>
                    </span>
                  )}
                </div>
                <DeliberationFeed
                  entries={deliberationEntries}
                  revisions={deliberationRevisions}
                  done={deliberationDone}
                />
              </motion.div>
            )}

            {displayResult && (
              <div className="terminal-card p-4" ref={outputRef}>
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
                  📋 Final Output — Run #{displayResult.runNumber}
                </div>
                <OutputPanel result={displayResult} />
              </div>
            )}

            {/* Side-by-side comparison — appears after auto demo completes */}
            {fastDemoResults.length === 4 && (() => {
              const r1 = fastDemoResults.find((r) => r.runNumber === 1);
              const r4 = fastDemoResults.find((r) => r.runNumber === 4);
              if (!r1 || !r4) return null;
              return (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="terminal-card p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-xs text-slate-600 uppercase tracking-wider">⚡ Run 1 vs Run 4 — What the Market Learned</div>
                    <div className="ml-auto flex items-center gap-2 text-xs font-mono">
                      <span className="text-amber-400">74</span>
                      <span className="text-slate-700">→</span>
                      <span className="text-cyan-400">96</span>
                      <span className="text-green-400 font-bold">+22</span>
                    </div>
                  </div>
                  <ComparisonView run1={r1} run4={r4} />
                </motion.div>
              );
            })()}

            {displayResult && showMath && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">🧮 Math Engine Snapshot</div>
                <MathPanel snapshot={displayResult.mathSnapshot} showMath={showMath} />
              </div>
            )}

            {/* Why not a wrapper */}
            <div className="terminal-card p-4">
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">⚡ Why this is not a ChatGPT wrapper</div>
              <div className="space-y-1.5">
                {[
                  { icon: "⚖️", text: "Agents compete for tasks before any generation happens" },
                  { icon: "🧠", text: "MarketMaker routes using reputation + uncertainty, not random assignment" },
                  { icon: "📊", text: "EvaluatorAgent scores output quality after every run" },
                  { icon: "⭐", text: "ReputationAgent updates future routing based on results" },
                  { icon: "💾", text: "Redis stores market memory — the next run is smarter" },
                  { icon: "🔍", text: "Weave traces every mission event end-to-end" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs font-mono">
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="text-slate-500 leading-relaxed">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {!displayResult && !loading && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="terminal-card p-5">
                {/* Guided CTA */}
                <div className="flex items-start gap-3 mb-5 p-3 rounded border border-green-900/40 bg-green-950/10">
                  <div className="text-lg leading-none mt-0.5">⚡</div>
                  <div>
                    <div className="text-sm font-bold text-green-400 mb-1">New here? Start with AUTO DEMO</div>
                    <div className="text-xs text-slate-500 leading-relaxed">
                      Watch 9 AI agents bid, compete, and self-improve across 4 runs in ~8 seconds.
                      The swarm makes a mistake on run 3, catches it, and peaks at 96 on run 4.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Run 1", value: "74", color: "#fbbf24", note: "factuality gap" },
                    { label: "Run 2", value: "91", color: "#00ff88", note: "market learned" },
                    { label: "Run 3", value: "85", color: "#ef4444", note: "⚠ over-rotation" },
                    { label: "Run 4", value: "96", color: "#22d3ee", note: "calibrated peak" },
                  ].map((s) => (
                    <div key={s.label} className="p-2 rounded border text-center" style={{ borderColor: `${s.color}30`, backgroundColor: `${s.color}05` }}>
                      <div className="text-xs text-slate-600 mb-1">{s.label}</div>
                      <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.note}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                  {[
                    { label: "Factuality gain", value: "+26 pts", color: "#00ff88" },
                    { label: "Risk reduction", value: "−23%", color: "#00aaff" },
                    { label: "Swarm objective", value: "0.61→0.94", color: "#a855f7" },
                    { label: "Regression", value: "91→85→96", color: "#ef4444" },
                    { label: "PitchAgent φ", value: "+21.4", color: "#22d3ee" },
                    { label: "Cost / run", value: "~$0.0022", color: "#fbbf24" },
                  ].map((m) => (
                    <div key={m.label} className="p-2 rounded border border-slate-900 bg-black/40">
                      <div className="text-slate-700 mb-0.5">{m.label}</div>
                      <div className="font-bold" style={{ color: m.color }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
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
          <div className="md:col-span-2 lg:col-span-1 space-y-4">
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

            {liveScore && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">📊 Eval Score</div>
                <ScorePanel score={liveScore} runNum={displayResult?.runNumber ?? runCount + 1} improvement={displayResult?.improvementFromPrevious} runCost={displayResult?.runCost} weaveTraceUrl={displayResult?.weaveTraceUrl} />
              </div>
            )}

            {liveRepChanges.length > 0 && (
              <div className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">📈 Reputation Updates</div>
                <ReputationLog changes={liveRepChanges} />
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

            <div className="terminal-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-600 uppercase tracking-wider">Redis Market Intelligence</span>
                <button onClick={() => void fetchMarketMemory()} className="ml-auto text-xs text-slate-700 hover:text-slate-500 transition-colors">↺</button>
              </div>
              <MarketIntelligencePanel intelligence={marketIntelligence} />
            </div>

            {/* Market Memory panel */}
            <div className="terminal-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-600 uppercase tracking-wider">🗄 Market Memory</span>
                <span className="text-xs font-mono text-green-700 ml-1">{totalMissions > 0 ? `${totalMissions} missions` : ""}</span>
                <button onClick={() => void fetchMarketMemory()} className="ml-auto text-xs text-slate-700 hover:text-slate-500 transition-colors">↺</button>
              </div>
              {marketFeed.length === 0 && totalMissions === 0 && !displayResult && (
                <div className="text-xs font-mono text-slate-800">no history yet — run a mission first</div>
              )}
              {displayResult && marketFeed.length === 0 && (
                <div className="space-y-1.5 mb-3">
                  <div className="text-xs font-mono text-green-700">● Run #{displayResult.runNumber} complete — score {displayResult.evalScore.overall}/100</div>
                  {displayResult.reputationChanges.slice(0, 4).map((c) => (
                    <div key={c.agentId} className="text-xs font-mono" style={{ color: c.delta > 0 ? "#00ff88" : c.delta < 0 ? "#ef4444" : "#64748b" }}>
                      {c.delta > 0 ? "▲" : c.delta < 0 ? "▼" : "─"} {c.agentName} {c.delta > 0 ? `+${c.delta}` : c.delta} rep — {c.reason.slice(0, 55)}
                    </div>
                  ))}
                  {displayResult.improvementFromPrevious && (
                    <div className="text-xs font-mono text-slate-600 mt-1">{displayResult.improvementFromPrevious.message.slice(0, 80)}</div>
                  )}
                </div>
              )}
              {marketFeed.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {marketFeed.slice(0, 6).map((ev, i) => (
                    <div key={i} className="text-xs font-mono leading-relaxed" style={{ color: ev.color ?? "#64748b" }}>{ev.text}</div>
                  ))}
                </div>
              )}
              {recentMissions.length > 0 && (
                <div className="mt-3 border-t border-slate-900 pt-3">
                  <div className="text-xs text-slate-700 uppercase tracking-wider mb-2">Recent Runs</div>
                  {recentMissions.slice(0, 5).map((m) => {
                    const color = m.overallScore >= 90 ? "#22d3ee" : m.overallScore >= 85 ? "#00ff88" : m.overallScore >= 80 ? "#fbbf24" : "#ef4444";
                    return (
                      <button key={m.missionId} onClick={() => void selectReplay(m.missionId)}
                        className="w-full text-left flex items-center gap-2 py-1.5 border-b border-slate-900 last:border-0 hover:bg-slate-950/60 transition-colors px-1 rounded"
                      >
                        <span className="text-xs font-mono text-slate-600 w-10">#{m.runNumber}</span>
                        <span className="text-xs font-mono flex-1 text-slate-500 truncate">{m.mission.slice(0, 45)}</span>
                        <span className="text-xs font-mono font-bold" style={{ color }}>{m.overallScore}</span>
                        <span className="text-slate-700 text-xs">{replayMissionId === m.missionId ? "▲" : "▼"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mission Replay panel — shown when user selects a run */}
            {replayMission && replayMissionId && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="terminal-card p-4">
                <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">
                  ⏪ Replay — Run #{replayMission.runNumber}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(["quality", "factuality", "actionability"] as const).map((k) => {
                    const v = replayMission.evalScore[k];
                    const c = v >= 88 ? "#00ff88" : v >= 75 ? "#fbbf24" : "#ef4444";
                    return (
                      <div key={k} className="text-center p-2 rounded border border-slate-900 bg-black/40">
                        <div className="text-slate-700 text-xs font-mono">{k.slice(0, 5)}</div>
                        <div className="text-lg font-black font-mono" style={{ color: c }}>{v}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-700 uppercase tracking-wider mb-2">Event Timeline</div>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border-l-2 border-green-900/30 pl-3">
                  {replayEvents.length === 0 && (
                    <div className="text-xs font-mono text-slate-800">No events stored — run with Redis configured to capture events.</div>
                  )}
                  {replayEvents.map((ev, i) => {
                    const c: Record<string, string> = { mission_received: "#00aaff", swarm_selected: "#00ff88", agent_started: "#475569", agent_completed: "#475569", reputation_updated: "#fbbf24", mission_completed: "#00ff88" };
                    return (
                      <div key={i} className="text-xs font-mono" style={{ color: c[ev.eventType] ?? "#64748b" }}>{ev.message}</div>
                    );
                  })}
                </div>
                {replayMission.reputationChanges.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-900 space-y-1.5">
                    <div className="text-xs text-slate-700 uppercase tracking-wider mb-1">Rep Outcome</div>
                    {replayMission.reputationChanges.map((c) => (
                      <div key={c.agentId} className="flex items-center gap-2 text-xs font-mono">
                        <span className="flex-1 text-slate-500">{c.agentName}</span>
                        <span className="font-bold" style={{ color: c.delta > 0 ? "#00ff88" : c.delta < 0 ? "#ef4444" : "#64748b" }}>
                          {c.delta > 0 ? "+" : ""}{c.delta}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {studioOpen && (
          <AgentStudioModal
            onClose={() => setStudioOpen(false)}
            onCreated={() => void fetchAgentsRef.current()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
