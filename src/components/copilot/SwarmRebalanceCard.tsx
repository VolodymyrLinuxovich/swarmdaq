"use client";

export interface RebalanceResult {
  goal: string;
  recommended: Array<{ id: string; name: string; score: number; reason: string }>;
  removed: Array<{ id: string; name: string; reason: string }>;
  added: Array<{ id: string; name: string; reason: string }>;
  tradeoffs: string;
  expectedQuality: number;
  expectedCost: number;
}

export function SwarmRebalanceCard({ result }: { result: RebalanceResult }) {
  const goalColors: Record<string, string> = {
    quality: "#00ff88", cost: "#fbbf24", speed: "#00aaff", factuality: "#a855f7", balanced: "#22d3ee",
  };
  const color = goalColors[result.goal] ?? "#00ff88";

  return (
    <div style={{ background: "#050505", border: `1px solid ${color}30`, borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        ⚡ Swarm Rebalance — optimize for {result.goal}
      </div>

      {/* Recommended swarm */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: "#475569", marginBottom: 6 }}>Recommended swarm</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {result.recommended.map((a) => (
            <div key={a.id} style={{ display: "flex", gap: 8, padding: "4px 8px", borderRadius: 4, background: `${color}08`, border: `1px solid ${color}18` }}>
              <span style={{ color }}>{a.name}</span>
              <span style={{ color: "#475569", flex: 1 }}>{a.reason}</span>
              <span style={{ color, fontWeight: 700 }}>{a.score.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Changes */}
      {result.removed.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "#ef4444", marginBottom: 4 }}>Remove</div>
          {result.removed.map((a) => (
            <div key={a.id} style={{ color: "#7f1d1d", padding: "2px 8px" }}>↓ {a.name} — {a.reason}</div>
          ))}
        </div>
      )}
      {result.added.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "#00ff88", marginBottom: 4 }}>Add</div>
          {result.added.map((a) => (
            <div key={a.id} style={{ color: "#14532d", padding: "2px 8px" }}>↑ {a.name} — {a.reason}</div>
          ))}
        </div>
      )}

      {/* Tradeoffs */}
      <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #1e293b", background: "#080808", color: "#64748b", lineHeight: 1.5 }}>
        {result.tradeoffs}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div style={{ padding: "6px 8px", borderRadius: 4, background: "#0f172a", textAlign: "center" }}>
          <div style={{ color: "#475569", fontSize: 10 }}>est. quality</div>
          <div style={{ color: "#00ff88", fontWeight: 700 }}>{result.expectedQuality.toFixed(0)}/100</div>
        </div>
        <div style={{ padding: "6px 8px", borderRadius: 4, background: "#0f172a", textAlign: "center" }}>
          <div style={{ color: "#475569", fontSize: 10 }}>est. cost</div>
          <div style={{ color: "#fbbf24", fontWeight: 700 }}>${result.expectedCost.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}
