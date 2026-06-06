"use client";
import type { MarketMemorySummary } from "@/lib/marketHistory";

const LABEL_COLORS: Record<string, string> = {
  BUY: "#00ff88", HOLD: "#fbbf24", SELL: "#ef4444", WATCH: "#00aaff",
};

export function MemoryCard({ summary }: { summary: MarketMemorySummary }) {
  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#e0e0e0", padding: "12px 0" }}>
      <div style={{ color: "#00ff88", fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: 1 }}>
        MARKET MEMORY [{summary.mode.toUpperCase()}]
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
        <div style={{ background: "rgba(0,255,136,0.07)", border: "1px solid rgba(0,255,136,0.15)", borderRadius: 4, padding: "6px 10px" }}>
          <div style={{ color: "#888", fontSize: 10 }}>TOTAL MISSIONS</div>
          <div style={{ color: "#00ff88", fontSize: 20, fontWeight: 700 }}>{summary.totalMissions}</div>
        </div>
        <div style={{ background: "rgba(0,170,255,0.07)", border: "1px solid rgba(0,170,255,0.15)", borderRadius: 4, padding: "6px 10px" }}>
          <div style={{ color: "#888", fontSize: 10 }}>STORAGE</div>
          <div style={{ color: "#00aaff", fontSize: 12, fontWeight: 700, marginTop: 4 }}>{summary.mode === "redis" ? "Upstash Redis" : "In-memory"}</div>
        </div>
      </div>

      {summary.topAgent && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: "#888" }}>TOP AGENT  </span>
          <span style={{ color: "#00ff88", fontWeight: 700 }}>{summary.topAgent.name}</span>
          <span style={{ color: "#888" }}> · rep {summary.topAgent.reputation}</span>
          <span style={{ marginLeft: 8, background: "#00ff88", color: "#000", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>BUY</span>
        </div>
      )}
      {summary.riskiestAgent && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ color: "#888" }}>RISKIEST   </span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>{summary.riskiestAgent.name}</span>
          <span style={{ color: "#888" }}> · uncertainty {(summary.riskiestAgent.uncertainty * 100).toFixed(1)}%</span>
          <span style={{ marginLeft: 8, background: "#ef4444", color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>WATCH</span>
        </div>
      )}

      {summary.leaderboard.length > 0 && (
        <>
          <div style={{ color: "#888", fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>LEADERBOARD</div>
          {summary.leaderboard.slice(0, 6).map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ color: "#555", width: 18, textAlign: "right" }}>{i + 1}.</span>
              <span style={{ color: "#ccc", flex: 1 }}>{a.name}</span>
              <span style={{ color: "#888", fontSize: 11 }}>{a.score}</span>
              <span style={{ background: LABEL_COLORS[a.label], color: a.label === "BUY" || a.label === "SELL" ? "#000" : "#000", padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700 }}>
                {a.label}
              </span>
            </div>
          ))}
        </>
      )}

      {summary.recentEvents.length > 0 && (
        <>
          <div style={{ color: "#888", fontSize: 10, marginTop: 12, marginBottom: 6, letterSpacing: 1 }}>RECENT MARKET EVENTS</div>
          {summary.recentEvents.slice(0, 5).map((ev, i) => (
            <div key={i} style={{ color: ev.color, fontSize: 11, marginBottom: 3, opacity: 0.9 }}>
              {ev.text}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
