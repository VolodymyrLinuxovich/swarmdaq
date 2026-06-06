"use client";

import type { TraceSummary } from "@/app/api/traces/route";

export function TraceTimelineCard({ traces }: { traces: TraceSummary }) {
  return (
    <div style={{ background: "#050505", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ color: "#a855f7", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
        🔭 W&B Weave Trace Timeline
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", marginBottom: 12 }}>
        {[
          { label: "LLM calls", val: traces.totalCalls, color: "#a855f7" },
          { label: "avg latency", val: `${traces.avgLatencyMs}ms`, color: "#fbbf24" },
          { label: "input tokens", val: traces.totalInputTokens.toLocaleString(), color: "#00aaff" },
          { label: "output tokens", val: traces.totalOutputTokens.toLocaleString(), color: "#00ff88" },
        ].map(({ label, val, color }) => (
          <>
            <span key={`${label}l`} style={{ color: "#475569" }}>{label}</span>
            <span key={`${label}v`} style={{ color }}>{val}</span>
          </>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #0f172a", paddingTop: 10 }}>
        {traces.calls.slice(0, 8).map((call, i) => {
          const latColor = call.latencyMs < 2000 ? "#22c55e" : call.latencyMs < 5000 ? "#fbbf24" : "#ef4444";
          return (
            <div key={call.id || i} style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px solid #0a0a0a", alignItems: "center" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
              <span style={{ flex: 1, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {call.op_name}
              </span>
              {call.totalTokens > 0 && <span style={{ color: "#334155" }}>{call.totalTokens}tok</span>}
              {call.latencyMs > 0 && (
                <span style={{ color: latColor, flexShrink: 0 }}>
                  {call.latencyMs < 1000 ? `${call.latencyMs}ms` : `${(call.latencyMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <a href="https://wandb.ai/vborysenko-uc-berkeley/swarmdaq/weave" target="_blank" rel="noopener noreferrer"
        style={{ display: "block", marginTop: 10, color: "#6d28d9", fontSize: 11 }}>
        open full trace explorer ↗
      </a>
    </div>
  );
}
