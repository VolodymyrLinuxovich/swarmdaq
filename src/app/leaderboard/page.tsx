"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  reputation: number;
  bayesianMean: number;
  uncertainty: number;
  elo: number;
  graphTrust: number;
  wins: number;
  losses: number;
  runs: number;
  label: "BUY" | "HOLD" | "SELL" | "WATCH";
}

const LABEL_COLOR: Record<string, string> = {
  BUY: "#00ff88",
  HOLD: "#fbbf24",
  SELL: "#ef4444",
  WATCH: "#00aaff",
};

const RANK_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32"];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [blink, setBlink] = useState(false);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) return;
      const { leaderboard, updatedAt: ts } = await res.json() as { leaderboard: LeaderboardEntry[]; updatedAt: number };
      setEntries(leaderboard);
      setUpdatedAt(ts);
      setBlink(true);
      setTimeout(() => setBlink(false), 400);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetch_();
    const id = setInterval(() => { void fetch_(); }, 3000);
    return () => clearInterval(id);
  }, [fetch_]);

  const buyCount = entries.filter((e) => e.label === "BUY").length;
  const sellCount = entries.filter((e) => e.label === "SELL").length;
  const avgRep = entries.length ? Math.round(entries.reduce((s, e) => s + e.reputation, 0) / entries.length) : 0;

  return (
    <div className="min-h-screen bg-black font-mono">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-green-900/30 bg-black/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-green-400 font-black tracking-widest hover:text-green-300">SWARMDAQ</Link>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-xs text-slate-500 uppercase tracking-widest">Agent Leaderboard</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <motion.div
              animate={{ opacity: blink ? [1, 0.2, 1] : 1 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-1.5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="hidden sm:inline text-xs text-green-700">live · 3s refresh</span>
            </motion.div>
            {updatedAt && (
              <span className="hidden sm:inline text-xs text-slate-800">
                {new Date(updatedAt).toLocaleTimeString()}
              </span>
            )}
            <Link href="/demo" className="text-xs text-slate-700 hover:text-slate-500 transition-colors">← demo</Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Agents", value: entries.length, color: "#00ff88" },
            { label: "Avg Rep", value: avgRep, color: "#fbbf24" },
            { label: "BUY signals", value: buyCount, color: "#00ff88" },
            { label: "SELL signals", value: sellCount, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} className="border border-slate-900 rounded p-3 bg-black/60">
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-1">{s.label}</div>
              <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="border border-slate-900 rounded overflow-hidden">
          <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
            <div className="min-w-[560px]">
              <div className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_3rem_3rem_4rem] gap-0 border-b border-slate-800 px-3 py-2 text-xs text-slate-600 uppercase tracking-wider">
                <span>#</span>
                <span>Agent</span>
                <span className="text-right">Rep</span>
                <span className="text-right">Bayes</span>
                <span className="text-right">ELO</span>
                <span className="text-right">Trust</span>
                <span className="text-right">W</span>
                <span className="text-right">L</span>
                <span className="text-center">Signal</span>
              </div>

              {loading && (
                <div className="px-4 py-8 text-center">
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}
                    className="text-green-600 text-sm">loading agents…</motion.div>
                </div>
              )}

              <AnimatePresence mode="sync">
                {entries.map((e, i) => {
                  const rankColor = i < 3 ? RANK_COLORS[i] : "#334155";
                  const lc = LABEL_COLOR[e.label] ?? "#64748b";
                  const repColor = e.reputation >= 90 ? "#00ff88" : e.reputation >= 80 ? "#fbbf24" : "#ef4444";
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="grid grid-cols-[2rem_1fr_4rem_4rem_4rem_4rem_3rem_3rem_4rem] gap-0 px-3 py-2.5 border-b border-slate-900 last:border-0 hover:bg-slate-950/60 transition-colors"
                    >
                      <span className="text-xs font-bold" style={{ color: rankColor }}>{e.rank}</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: lc }} />
                        <span className="text-sm font-bold text-slate-200 truncate">{e.name}</span>
                        {e.runs > 0 && (
                          <span className="text-xs text-slate-700 flex-shrink-0">{e.runs}r</span>
                        )}
                      </div>
                      <span className="text-right text-sm font-bold" style={{ color: repColor }}>{e.reputation}</span>
                      <span className="text-right text-xs text-blue-400">{(e.bayesianMean * 100).toFixed(0)}%</span>
                      <span className="text-right text-xs text-slate-400">{Math.round(e.elo)}</span>
                      <span className="text-right text-xs text-slate-500">{(e.graphTrust * 100).toFixed(0)}%</span>
                      <span className="text-right text-xs text-green-500">{e.wins}</span>
                      <span className="text-right text-xs text-red-600">{e.losses}</span>
                      <div className="flex justify-center">
                        <span
                          className="text-xs font-black px-1.5 py-0.5 rounded"
                          style={{ color: lc, backgroundColor: `${lc}15`, border: `1px solid ${lc}40` }}
                        >
                          {e.label}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs font-mono text-slate-700">
          {[
            { label: "BUY", desc: "bayesian > 84%, rep > 88, low uncertainty" },
            { label: "HOLD", desc: "stable, mid-tier performance" },
            { label: "SELL", desc: "low trust or reputation < 75" },
            { label: "WATCH", desc: "high uncertainty — insufficient data" },
          ].map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="font-bold" style={{ color: LABEL_COLOR[s.label] }}>{s.label}</span>
              <span>{s.desc}</span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-800">
          <Link href="/demo" className="hover:text-slate-500 transition-colors">← back to demo</Link>
        </div>
      </div>
    </div>
  );
}
