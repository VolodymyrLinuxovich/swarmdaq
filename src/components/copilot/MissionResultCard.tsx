"use client";

import type { MissionResult } from "@/lib/types";

export function MissionResultCard({ result }: { result: MissionResult }) {
  const s = result.evalScore;
  const scoreColor = s.overall >= 90 ? "#22d3ee" : s.overall >= 80 ? "#00ff88" : s.overall >= 70 ? "#fbbf24" : "#ef4444";

  return (
    <div style={{ background: "#050505", border: "1px solid rgba(0,255,136,0.25)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color: "#00ff88", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        ⚡ Mission Complete — Run #{result.runNumber}
      </div>

      {/* Score */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 36, fontWeight: 900, color: scoreColor }}>{s.overall}</span>
        <span style={{ color: "#475569" }}>/ 100</span>
        {result.runCost && (
          <span style={{ color: "#92400e", marginLeft: 8 }}>${result.runCost.totalUSD.toFixed(5)}</span>
        )}
      </div>

      {/* Dimension bars */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 28px", gap: "3px 6px", marginBottom: 12 }}>
        {(["quality", "factuality", "usefulness", "actionability"] as const).map((k) => {
          const v = s[k];
          const c = v >= 88 ? "#00ff88" : v >= 70 ? "#fbbf24" : "#ef4444";
          return [
            <span key={`${k}l`} style={{ color: "#475569" }}>{k}</span>,
            <div key={`${k}b`} style={{ background: "#0f172a", borderRadius: 2, overflow: "hidden", alignSelf: "center" }}>
              <div style={{ width: `${v}%`, height: 4, background: c, borderRadius: 2 }} />
            </div>,
            <span key={`${k}v`} style={{ color: c, textAlign: "right" }}>{v}</span>,
          ];
        })}
      </div>

      {/* Landing headline */}
      <div style={{ padding: "8px 10px", borderRadius: 6, border: `1px solid ${scoreColor}30`, background: `${scoreColor}08`, marginBottom: 10 }}>
        <div style={{ color: "#475569", fontSize: 9, textTransform: "uppercase", marginBottom: 4 }}>Landing Headline</div>
        <div style={{ color: scoreColor, fontWeight: 700, lineHeight: 1.4 }}>{result.output.landingHeadline}</div>
      </div>

      {/* Swarm */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: "#475569", marginBottom: 4 }}>Selected swarm</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {result.selectedAgents.map((a) => (
            <span key={a.id} style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", color: "#00ff88" }}>
              {a.name}
            </span>
          ))}
        </div>
      </div>

      {/* Improvement */}
      {result.improvementFromPrevious && (
        <div style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)", background: "rgba(5,46,22,0.3)", color: "#4ade80", fontSize: 11 }}>
          {result.improvementFromPrevious.message}
        </div>
      )}
    </div>
  );
}
