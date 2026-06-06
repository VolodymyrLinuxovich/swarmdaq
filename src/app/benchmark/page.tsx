"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import type { MissionResult } from "@/lib/types";

const BENCHMARKS = [
  {
    id: "market-sizing",
    name: "Market Sizing",
    runNumber: 1,
    runLabel: "Run 1 — Baseline",
    story: "Unverified claim detected. ResearchAgent penalized.",
    mission: "Analyze the market size and competitive landscape for a B2B SaaS tool targeting mid-market legal firms that want to automate contract review.",
    focus: "ResearchAgent (unverified)",
    emphasizes: ["research", "factuality", "specificity"],
  },
  {
    id: "gtm-strategy",
    name: "Go-to-Market",
    runNumber: 2,
    runLabel: "Run 2 — Market Learned",
    story: "SourceVerifier paired with Research. Factuality +26 pts.",
    mission: "Design a go-to-market strategy for a developer productivity CLI tool that reduces boilerplate code setup. Target: senior engineers at Series A–C startups.",
    focus: "ResearchAgent + SourceVerifierAgent",
    emphasizes: ["usefulness", "actionability", "quality"],
  },
  {
    id: "risk-analysis",
    name: "Risk Analysis",
    runNumber: 3,
    runLabel: "Run 3 — Over-Rotation",
    story: "SkepticAgent over-rotated. Risk-heavy pitch reduces usefulness.",
    mission: "Conduct a comprehensive risk analysis for an AI-generated content startup planning to launch in the EU under the new AI Act regulatory environment.",
    focus: "SkepticAgent (over-weighted)",
    emphasizes: ["factuality", "specificity", "collaboration"],
  },
  {
    id: "pitch-script",
    name: "Pitch Script",
    runNumber: 4,
    runLabel: "Run 4 — Calibrated Peak",
    story: "PitchAgent + BuilderAgent synergy. Best score across all dimensions.",
    mission: "Write a 90-second demo pitch for an IoT fleet management platform that reduces truck idle time by 34%. Target: Series A VCs with logistics portfolio.",
    focus: "PitchAgent + BuilderAgent (synergy)",
    emphasizes: ["quality", "actionability", "collaboration"],
  },
  {
    id: "product-positioning",
    name: "Positioning",
    runNumber: 2,
    runLabel: "Run 2 — Verified",
    story: "Collaborative swarm. All claims sourced. High actionability.",
    mission: "Define product positioning and landing page copy for a real-time collaborative whiteboard built for remote engineering teams doing system design interviews.",
    focus: "BuilderAgent + SourceVerifierAgent",
    emphasizes: ["usefulness", "quality", "specificity"],
  },
];

type BenchmarkStatus = "pending" | "running" | "done" | "error";

interface BenchmarkResult {
  id: string;
  runNumber: number;
  result: MissionResult;
  durationMs: number;
}

const DIM_KEYS = ["quality", "factuality", "usefulness", "specificity", "actionability", "collaboration"] as const;
const DIM_LABELS: Record<string, string> = {
  quality: "Quality", factuality: "Factual", usefulness: "Useful",
  specificity: "Specific", actionability: "Action", collaboration: "Collab",
};

function scoreColor(v: number) {
  return v >= 92 ? "#22d3ee" : v >= 88 ? "#00ff88" : v >= 78 ? "#fbbf24" : "#ef4444";
}

export default function BenchmarkPage() {
  const [statuses, setStatuses] = useState<Record<string, BenchmarkStatus>>({});
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState(false);
  const [totalCost, setTotalCost] = useState(0);

  const setStatus = (id: string, s: BenchmarkStatus) =>
    setStatuses((prev) => ({ ...prev, [id]: s }));

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    setResults([]);
    setTotalCost(0);
    const newStatuses: Record<string, BenchmarkStatus> = {};
    for (const b of BENCHMARKS) newStatuses[b.id] = "pending";
    setStatuses(newStatuses);

    let accCost = 0;

    for (let i = 0; i < BENCHMARKS.length; i++) {
      const bench = BENCHMARKS[i];
      setStatus(bench.id, "running");
      const startMs = Date.now();
      try {
        const res = await fetch("/api/mission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mission: bench.mission, runNumber: bench.runNumber }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MissionResult = await res.json();
        const dur = Date.now() - startMs;
        setResults((prev) => [...prev, { id: bench.id, runNumber: bench.runNumber, result: data, durationMs: dur }]);
        accCost += data.runCost?.totalUSD ?? 0;
        setTotalCost(accCost);
        setStatus(bench.id, "done");
      } catch {
        setStatus(bench.id, "error");
      }
    }
    setRunning(false);
  };

  const getResult = (id: string) => results.find((r) => r.id === id);
  const allDone = BENCHMARKS.every((b) => statuses[b.id] === "done");

  return (
    <div className="min-h-screen bg-black font-mono grid-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-sm border-b border-green-900/20">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs neon-green font-black tracking-widest">SWARMDAQ</Link>
          <div className="h-3 w-px bg-slate-700" />
          <span className="text-xs text-slate-600">benchmark suite</span>
        </div>
        <div className="flex items-center gap-3">
          {totalCost > 0 && (
            <span className="text-xs font-mono text-amber-500">total: ${totalCost.toFixed(5)}</span>
          )}
          <Link href="/demo" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">live demo</Link>
          <Link href="/architecture" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">architecture</Link>
        </div>
      </nav>

      <div className="p-4 max-w-screen-xl mx-auto space-y-4">
        {/* Header */}
        <div className="terminal-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-600 uppercase tracking-wider mb-1">Agent Benchmark Suite</div>
              <div className="text-sm text-slate-300">5 standard evaluation tasks · measures factuality, narrative quality, risk calibration, actionability</div>
              <div className="text-xs text-slate-600 mt-1">
                Runs each task through the full swarm (auction → execution → eval). Cycles runs 1→4 to demonstrate the learning arc across mission types.
              </div>
            </div>
            <button onClick={runAll} disabled={running}
              className="px-6 py-2.5 text-xs font-black bg-green-500 text-black rounded hover:bg-green-400 transition-all disabled:opacity-50 glow-green flex-shrink-0 ml-4">
              {running ? "● RUNNING..." : "▶ RUN ALL"}
            </button>
          </div>
        </div>

        {/* Benchmark cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {BENCHMARKS.map((bench, i) => {
            const status = statuses[bench.id] ?? "pending";
            const r = getResult(bench.id);
            const score = r?.result.evalScore.overall;
            const cost = r?.result.runCost;
            const statusColor: Record<BenchmarkStatus, string> = {
              pending: "#334155", running: "#fbbf24", done: "#00ff88", error: "#ef4444",
            };
            return (
              <motion.div key={bench.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="terminal-card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-xs text-slate-600 uppercase tracking-wider mb-0.5">#{i + 1} · {bench.runLabel}</div>
                    <div className="text-sm font-bold text-slate-200">{bench.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status === "running" && (
                      <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.8, repeat: Infinity }}
                        className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor.running }} />
                    )}
                    {status !== "running" && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor[status] }} />
                    )}
                    <span className="text-xs font-mono" style={{ color: statusColor[status] }}>
                      {status === "running" ? "running…" : status}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-700 mb-3 leading-relaxed line-clamp-2">{bench.mission}</div>

                <div className="text-xs font-mono text-slate-600 mb-1">
                  lead: <span className="text-slate-500">{bench.focus}</span>
                </div>
                <div className="text-xs text-slate-700 mb-2 italic">{bench.story}</div>

                {score !== undefined ? (
                  <div>
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-3xl font-black" style={{ color: scoreColor(score) }}>{score}</span>
                      <span className="text-slate-600 text-xs">/ 100</span>
                      {cost && (
                        <span className="text-xs font-mono text-amber-500/70 ml-auto">${cost.totalUSD.toFixed(5)}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {DIM_KEYS.map((k) => {
                        const val = r!.result.evalScore[k];
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-slate-700 w-14">{DIM_LABELS[k]}</span>
                            <div className="flex-1 h-1 bg-slate-900 rounded overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${val}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="h-full rounded" style={{ backgroundColor: scoreColor(val) }} />
                            </div>
                            <span className="w-6 text-right text-xs font-mono" style={{ color: scoreColor(val) }}>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                    {r?.result.weaveTraceUrl && (
                      <a href={r.result.weaveTraceUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-3 flex items-center gap-1 text-xs font-mono text-purple-700 hover:text-purple-400 transition-colors">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600/60 inline-block" />
                        view traces ↗
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {DIM_KEYS.map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-slate-800 w-14">{DIM_LABELS[k]}</span>
                        <div className="flex-1 h-1 bg-slate-900 rounded" />
                        <span className="w-6 text-right text-xs font-mono text-slate-800">--</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Summary table — shown when all done */}
        {allDone && results.length === 5 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="terminal-card p-4">
            <div className="text-xs text-slate-600 uppercase tracking-wider mb-4">Benchmark Summary</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-900">
                    <th className="text-left text-slate-600 py-2 pr-4">Task</th>
                    <th className="text-center text-slate-600 py-2 px-2">Run</th>
                    {DIM_KEYS.map((k) => (
                      <th key={k} className="text-center text-slate-600 py-2 px-2">{DIM_LABELS[k]}</th>
                    ))}
                    <th className="text-center text-slate-600 py-2 px-2">Score</th>
                    <th className="text-right text-slate-600 py-2 pl-2">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {BENCHMARKS.map((bench) => {
                    const r = getResult(bench.id);
                    if (!r) return null;
                    const s = r.result.evalScore;
                    return (
                      <tr key={bench.id} className="border-b border-slate-900/50 hover:bg-slate-950/40">
                        <td className="text-slate-400 py-2 pr-4">{bench.name}</td>
                        <td className="text-center text-slate-600 py-2 px-2">{r.runNumber}</td>
                        {DIM_KEYS.map((k) => (
                          <td key={k} className="text-center py-2 px-2" style={{ color: scoreColor(s[k]) }}>{s[k]}</td>
                        ))}
                        <td className="text-center py-2 px-2 font-bold" style={{ color: scoreColor(s.overall) }}>{s.overall}</td>
                        <td className="text-right py-2 pl-2 text-amber-500/70">
                          {r.result.runCost ? `$${r.result.runCost.totalUSD.toFixed(5)}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-slate-700">
                    <td className="text-slate-500 py-2 pr-4 font-bold" colSpan={2}>Average</td>
                    {DIM_KEYS.map((k) => {
                      const avg = Math.round(results.reduce((s, r) => s + r.result.evalScore[k], 0) / results.length);
                      return <td key={k} className="text-center py-2 px-2 font-bold" style={{ color: scoreColor(avg) }}>{avg}</td>;
                    })}
                    <td className="text-center py-2 px-2 font-bold" style={{ color: scoreColor(Math.round(results.reduce((s, r) => s + r.result.evalScore.overall, 0) / results.length)) }}>
                      {Math.round(results.reduce((s, r) => s + r.result.evalScore.overall, 0) / results.length)}
                    </td>
                    <td className="text-right py-2 pl-2 text-amber-500 font-bold">${totalCost.toFixed(5)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
