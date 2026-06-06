"use client";

import type { Agent } from "@/lib/types";

export type AgentLabel = "BUY" | "HOLD" | "SELL" | "WATCH";

export function getAgentLabel(agent: Agent): AgentLabel {
  if (agent.uncertainty > 0.12) return "WATCH";
  if (agent.bayesianMean > 0.84 && agent.reputation > 88 && agent.uncertainty < 0.09) return "BUY";
  if (agent.bayesianMean < 0.65 || agent.reputation < 75) return "SELL";
  return "HOLD";
}

const LABEL_STYLE: Record<AgentLabel, { color: string; bg: string; border: string }> = {
  BUY:   { color: "#00ff88", bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.3)" },
  HOLD:  { color: "#fbbf24", bg: "rgba(251,191,36,0.06)", border: "rgba(251,191,36,0.2)" },
  SELL:  { color: "#ef4444", bg: "rgba(239,68,68,0.07)",  border: "rgba(239,68,68,0.25)" },
  WATCH: { color: "#00aaff", bg: "rgba(0,170,255,0.07)",  border: "rgba(0,170,255,0.25)" },
};

export function WeakAgentCard({ agents, weakest }: { agents: Agent[]; weakest: Agent }) {
  const label = getAgentLabel(weakest);
  const labelStyle = LABEL_STYLE[label];

  return (
    <div style={{ background: "#050505", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color: "#ef4444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        📉 Market Weakness Analysis
      </div>

      {/* Weakest agent */}
      <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${labelStyle.border}`, background: labelStyle.bg, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13 }}>{weakest.name}</span>
          <span style={{ color: labelStyle.color, fontWeight: 900, padding: "2px 10px", borderRadius: 4, border: `1px solid ${labelStyle.border}`, background: labelStyle.bg }}>
            {label}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {[
            { label: "bayes", val: weakest.bayesianMean.toFixed(2), color: weakest.bayesianMean < 0.65 ? "#ef4444" : "#00aaff" },
            { label: "uncert", val: weakest.uncertainty.toFixed(2), color: weakest.uncertainty > 0.12 ? "#fbbf24" : "#475569" },
            { label: "rep", val: weakest.reputation.toString(), color: weakest.reputation < 75 ? "#ef4444" : "#64748b" },
            { label: "elo", val: weakest.elo.toString(), color: "#475569" },
            { label: "trust", val: weakest.graphTrust.toFixed(2), color: "#475569" },
            { label: "cost", val: `$${weakest.price.toFixed(2)}`, color: "#475569" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ padding: "4px 6px", borderRadius: 4, background: "#0a0a0a", textAlign: "center" }}>
              <div style={{ color: "#334155", fontSize: 9 }}>{label}</div>
              <div style={{ color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full leaderboard */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ color: "#334155", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Full Registry — Market Labels</div>
        {[...agents].sort((a, b) => b.bayesianMean - a.bayesianMean).map((a) => {
          const lbl = getAgentLabel(a);
          const ls = LABEL_STYLE[lbl];
          const isTarget = a.id === weakest.id;
          return (
            <div key={a.id} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px solid #0a0a0a", alignItems: "center" }}>
              <span style={{ flex: 1, color: isTarget ? "#e2e8f0" : "#475569", fontWeight: isTarget ? 700 : 400 }}>{a.name}</span>
              <span style={{ color: "#334155", fontSize: 11 }}>{a.bayesianMean.toFixed(2)} μ</span>
              <span style={{ color: ls.color, fontSize: 10, padding: "1px 6px", borderRadius: 3, border: `1px solid ${ls.border}`, background: ls.bg }}>
                {lbl}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
