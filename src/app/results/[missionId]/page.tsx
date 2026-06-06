"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { MissionResult, ReputationChange } from "@/lib/types";
import type { MissionEvent } from "@/lib/marketHistory";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 88 ? "#00ff88" : value >= 75 ? "#fbbf24" : "#ef4444";
  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <span className="text-slate-600 w-24">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-900 rounded overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

function RepChange({ c }: { c: ReputationChange }) {
  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <span
        className="font-bold w-8 flex-shrink-0"
        style={{ color: c.delta > 0 ? "#00ff88" : c.delta < 0 ? "#ef4444" : "#64748b" }}
      >
        {c.delta > 0 ? `+${c.delta}` : c.delta}
      </span>
      <div>
        <div className="text-slate-300">{c.agentName}</div>
        <div className="text-slate-700">{c.reason}</div>
      </div>
    </div>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = use(params);
  const [mission, setMission] = useState<MissionResult | null>(null);
  const [events, setEvents] = useState<MissionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/history/${missionId}`);
        if (res.status === 404) { setNotFound(true); return; }
        const data = await res.json() as { mission: MissionResult; events: MissionEvent[] };
        setMission(data.mission);
        setEvents(data.events);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [missionId]);

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
          className="text-green-600 text-sm">loading mission…</motion.div>
      </div>
    );
  }

  if (notFound || !mission) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <div className="text-slate-600 text-sm">mission not found</div>
          <div className="text-slate-800 text-xs">{missionId}</div>
          <Link href="/demo" className="text-xs text-green-600 hover:text-green-400 transition-colors">← back to demo</Link>
        </div>
      </div>
    );
  }

  const score = mission.evalScore;
  const overallColor = score.overall >= 90 ? "#00ff88" : score.overall >= 85 ? "#fbbf24" : "#ef4444";

  return (
    <div className="min-h-screen bg-black font-mono">
      <div className="sticky top-0 z-10 border-b border-green-900/30 bg-black/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-green-400 font-black tracking-widest hover:text-green-300">SWARMDAQ</Link>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-xs text-slate-600">mission result</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={copyLink}
              className="px-2 sm:px-3 py-1.5 text-xs font-mono rounded border border-slate-700 text-slate-400 hover:border-green-600 hover:text-green-400 transition-colors"
            >
              {copied ? "✓ copied" : "⎘ copy"}
            </button>
            <Link href="/leaderboard" className="hidden sm:inline text-xs text-slate-600 hover:text-slate-400 transition-colors">leaderboard</Link>
            <Link href="/demo" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">demo</Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="border border-slate-800 rounded p-5 bg-black/60">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-1">Run #{mission.runNumber} · {missionId.slice(0, 8)}</div>
              <div className="text-slate-300 text-sm leading-relaxed">{mission.mission}</div>
            </div>
            <div className="text-center flex-shrink-0">
              <div className="text-4xl sm:text-5xl font-black" style={{ color: overallColor }}>{score.overall}</div>
              <div className="text-xs text-slate-600 mt-1">/ 100</div>
            </div>
          </div>

          {mission.runCost && (
            <div className="flex items-center gap-3 text-xs font-mono text-slate-700">
              <span className="text-amber-600">${mission.runCost.totalUSD.toFixed(5)}</span>
              <span>·</span>
              <span>{(mission.runCost.inputTokens + mission.runCost.outputTokens).toLocaleString()} tokens</span>
              <span>·</span>
              <span>{mission.runCost.model}</span>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Score breakdown */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="border border-slate-900 rounded p-4">
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">Eval Scorecard</div>
            <div className="space-y-2">
              {(["quality", "factuality", "usefulness", "specificity", "actionability", "collaboration"] as const).map((k) => (
                <ScoreBar key={k} label={k} value={score[k]} />
              ))}
            </div>
          </motion.div>

          {/* Reputation changes */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="border border-slate-900 rounded p-4">
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">Reputation Changes</div>
            {mission.reputationChanges.length === 0 ? (
              <div className="text-xs text-slate-800">no changes recorded</div>
            ) : (
              <div className="space-y-2">
                {mission.reputationChanges.map((c) => <RepChange key={c.agentId} c={c} />)}
              </div>
            )}
          </motion.div>
        </div>

        {/* Landing headline */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="border rounded p-4" style={{ borderColor: `${overallColor}30`, backgroundColor: `${overallColor}04` }}>
          <div className="text-xs text-slate-600 uppercase tracking-wider mb-2">Landing Headline</div>
          <div className="text-xl font-bold" style={{ color: overallColor }}>{mission.output.landingHeadline}</div>
        </motion.div>

        {/* Pitch */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="border border-slate-900 rounded p-4">
          <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">90-Second Pitch</div>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {mission.output.pitch.split(/(\[\d+-?\d*s\])/).filter(Boolean).reduce<Array<{time: string; body: string}>>((acc, seg) => {
              if (/^\[\d+-?\d*s\]$/.test(seg)) { acc.push({ time: seg, body: "" }); }
              else if (acc.length > 0) { acc[acc.length - 1].body += seg; }
              else { acc.push({ time: "", body: seg }); }
              return acc;
            }, []).map((p, i) => p.body.trim() && (
              <div key={i} className="flex gap-3 p-3 rounded border border-slate-900 bg-slate-950/40">
                {p.time && <span className="text-xs font-bold text-amber-500/80 w-14 flex-shrink-0 mt-0.5">{p.time}</span>}
                <p className="text-xs text-slate-300 leading-relaxed">{p.body.trim()}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Swarm composition */}
        {mission.output.swarmComposition.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="border border-slate-900 rounded p-4">
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">Swarm Composition</div>
            <div className="flex flex-wrap gap-2">
              {mission.output.swarmComposition.map((s, i) => (
                <span key={i} className="text-xs font-mono px-2 py-1 rounded border border-green-900/40 text-green-700 bg-green-950/20">{s}</span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Event timeline */}
        {events.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="border border-slate-900 rounded p-4">
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">Event Timeline</div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto border-l-2 border-green-900/30 pl-3">
              {events.map((ev, i) => {
                const c: Record<string, string> = {
                  mission_received: "#00aaff", swarm_selected: "#00ff88",
                  agent_started: "#475569", agent_completed: "#64748b",
                  reputation_updated: "#fbbf24", mission_completed: "#00ff88",
                };
                return (
                  <div key={i} className="text-xs font-mono" style={{ color: c[ev.eventType] ?? "#64748b" }}>
                    {ev.message}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Improvement */}
        {mission.improvementFromPrevious && mission.runNumber >= 2 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="border border-slate-900 rounded p-4">
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-3">vs. Previous Run</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              {[
                { label: "score delta", value: `${mission.improvementFromPrevious.currentScore - mission.improvementFromPrevious.previousScore > 0 ? "+" : ""}${mission.improvementFromPrevious.currentScore - mission.improvementFromPrevious.previousScore}`, color: mission.improvementFromPrevious.currentScore >= mission.improvementFromPrevious.previousScore ? "#00ff88" : "#ef4444" },
                { label: "factuality Δ", value: `${mission.improvementFromPrevious.factualityDelta > 0 ? "+" : ""}${mission.improvementFromPrevious.factualityDelta}`, color: mission.improvementFromPrevious.factualityDelta >= 0 ? "#00ff88" : "#ef4444" },
                { label: "confidence Δ", value: `${mission.improvementFromPrevious.confidenceDelta > 0 ? "+" : ""}${mission.improvementFromPrevious.confidenceDelta}%`, color: "#fbbf24" },
                { label: "message", value: mission.improvementFromPrevious.message, color: "#64748b" },
              ].map((m) => (
                <div key={m.label} className="p-3 rounded border border-slate-900 bg-black/40">
                  <div className="text-slate-700 mb-1">{m.label}</div>
                  <div className="font-bold" style={{ color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="flex items-center gap-4 text-xs text-slate-800 pb-8">
          <Link href="/demo" className="hover:text-slate-500 transition-colors">← run your own mission</Link>
          <Link href="/leaderboard" className="hover:text-slate-500 transition-colors">leaderboard →</Link>
        </div>
      </div>
    </div>
  );
}
