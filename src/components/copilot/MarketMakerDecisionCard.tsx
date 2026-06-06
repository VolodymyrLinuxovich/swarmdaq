"use client";

import type { MarketDecisionEntry } from "@/lib/types";

export function MarketMakerDecisionCard({ log, explanation }: { log: MarketDecisionEntry[]; explanation?: string }) {
  return (
    <div style={{ background: "#050505", border: "1px solid rgba(0,170,255,0.25)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color: "#00aaff", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        🧠 MarketMaker Decision Analysis
      </div>

      {explanation && (
        <div style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(0,170,255,0.15)", background: "rgba(0,170,255,0.05)", color: "#94a3b8", lineHeight: 1.5, marginBottom: 12, fontSize: 12 }}>
          {explanation}
        </div>
      )}

      {log.map((entry) => {
        const winner = entry.candidates[0];
        const runnerUp = entry.candidates[1];
        const margin = winner && runnerUp ? winner.compositeScore - runnerUp.compositeScore : 0;
        return (
          <div key={entry.taskType} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, border: "1px solid #1e293b", background: "#080808" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#475569", textTransform: "uppercase", fontSize: 10 }}>{entry.taskType.replace(/_/g, " ")}</span>
              <span style={{ color: "#00ff88", fontWeight: 700 }}>{entry.winnerName}</span>
            </div>
            {winner && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, fontSize: 11 }}>
                {[
                  { label: "skill", val: winner.skillMatch },
                  { label: "bayes", val: winner.bayesianMean },
                  { label: "ucb", val: winner.ucb },
                  { label: "trust", val: winner.graphTrust },
                ].map(({ label, val }) => (
                  <div key={label} style={{ padding: "3px 6px", borderRadius: 3, background: "#0f172a", textAlign: "center" }}>
                    <div style={{ color: "#334155", fontSize: 9 }}>{label}</div>
                    <div style={{ color: "#00aaff" }}>{val.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
            {margin > 0 && (
              <div style={{ color: "#334155", fontSize: 10, marginTop: 4 }}>
                margin over #{2}: +{margin.toFixed(4)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
