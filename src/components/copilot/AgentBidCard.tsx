"use client";

import type { AgentBid } from "@/lib/types";

export function AgentBidCard({ bids, agentNames }: { bids: AgentBid[]; agentNames?: Record<string, string> }) {
  const grouped: Record<string, AgentBid[]> = {};
  for (const b of bids) {
    if (!grouped[b.taskId]) grouped[b.taskId] = [];
    grouped[b.taskId].push(b);
  }

  return (
    <div style={{ background: "#050505", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color: "#a855f7", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        ⚖️ Vickrey Auction Log
      </div>
      {Object.entries(grouped).map(([taskId, taskBids]) => {
        const sorted = [...taskBids].sort((a, b) => b.utilityBid - a.utilityBid);
        return (
          <div key={taskId} style={{ marginBottom: 12 }}>
            <div style={{ color: "#475569", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{taskId.replace(/_/g, " ")}</div>
            {sorted.slice(0, 3).map((bid) => (
              <div key={bid.agentId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: "1px solid #0f172a" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: bid.isWinner ? "#00ff88" : "#1e293b", flexShrink: 0 }} />
                <span style={{ flex: 1, color: bid.isWinner ? "#e2e8f0" : "#475569" }}>
                  {agentNames?.[bid.agentId] ?? bid.agentId}
                </span>
                <span style={{ color: "#64748b", fontSize: 11 }}>conf {(bid.confidence * 100).toFixed(0)}%</span>
                <span style={{ color: bid.isWinner ? "#00ff88" : "#475569", fontWeight: bid.isWinner ? 700 : 400 }}>
                  {bid.utilityBid.toFixed(3)}
                </span>
                {bid.isWinner && <span style={{ color: "#00ff88", fontSize: 10 }}>WIN</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
