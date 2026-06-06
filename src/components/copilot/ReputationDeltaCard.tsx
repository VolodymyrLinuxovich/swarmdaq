"use client";

import type { ReputationChange } from "@/lib/types";

export function ReputationDeltaCard({ changes, runNumber }: { changes: ReputationChange[]; runNumber?: number }) {
  return (
    <div style={{ background: "#050505", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color: "#00ff88", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        📈 Reputation Ledger{runNumber ? ` — Run #${runNumber}` : ""}
      </div>

      {changes.map((c) => {
        const color = c.delta > 0 ? "#00ff88" : c.delta < 0 ? "#ef4444" : "#475569";
        return (
          <div key={c.agentId} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #0f172a", alignItems: "flex-start" }}>
            <span style={{ fontWeight: 900, color, minWidth: 32, flexShrink: 0, fontSize: 13 }}>
              {c.delta > 0 ? `+${c.delta}` : c.delta}
            </span>
            <div>
              <div style={{ color: "#e2e8f0", marginBottom: 2 }}>{c.agentName}</div>
              <div style={{ color: "#475569" }}>{c.reason}</div>
              {c.eloDelta !== 0 && (
                <div style={{ color: "#334155", fontSize: 10, marginTop: 2 }}>
                  Elo {c.eloDelta > 0 ? "+" : ""}{c.eloDelta} · α{c.alphaDelta > 0 ? "+" : ""}{c.alphaDelta.toFixed(1)} · β+{c.betaDelta.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
