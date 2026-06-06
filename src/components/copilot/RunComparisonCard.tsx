"use client";
import type { MissionResult } from "@/lib/types";

interface Delta {
  overall: number;
  quality: number;
  factuality: number;
  usefulness: number;
  actionability: number;
  cost: number;
  swarmObjective: number;
}

export function RunComparisonCard({
  runAResult,
  runBResult,
  delta,
  explanation,
}: {
  runAResult: MissionResult;
  runBResult: MissionResult;
  delta: Delta;
  explanation: string;
}) {
  const dims: Array<{ key: keyof Delta; label: string; invert?: boolean }> = [
    { key: "overall",       label: "Overall" },
    { key: "quality",       label: "Quality" },
    { key: "factuality",    label: "Factuality" },
    { key: "usefulness",    label: "Usefulness" },
    { key: "actionability", label: "Actionability" },
    { key: "cost",          label: "Cost Δ ($)", invert: true },
    { key: "swarmObjective", label: "Swarm Obj." },
  ];

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#e0e0e0", padding: "12px 0" }}>
      <div style={{ color: "#00ff88", fontWeight: 700, marginBottom: 10, fontSize: 13, letterSpacing: 1 }}>
        RUN COMPARISON: #{runAResult.runNumber} vs #{runBResult.runNumber}
      </div>

      <div style={{ color: "#888", fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>{explanation}</div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr", gap: "4px 12px", alignItems: "center" }}>
        <div style={{ color: "#555", fontSize: 10 }}>DIMENSION</div>
        <div style={{ color: "#888", fontSize: 10, textAlign: "center" }}>Run {runAResult.runNumber}</div>
        <div style={{ color: "#888", fontSize: 10, textAlign: "center" }}>Run {runBResult.runNumber}</div>
        <div style={{ color: "#888", fontSize: 10, textAlign: "center" }}>DELTA</div>

        {dims.map(({ key, label, invert }) => {
          const d = delta[key];
          const positive = invert ? d < 0 : d > 0;
          const color = d === 0 ? "#555" : positive ? "#00ff88" : "#ef4444";
          const aVal = key === "cost"
            ? `$${((runAResult.runCost?.totalUSD ?? 0)).toFixed(4)}`
            : key === "swarmObjective"
            ? runAResult.swarmPortfolio.objective.toFixed(3)
            : (runAResult.evalScore as unknown as Record<string, number>)[key];
          const bVal = key === "cost"
            ? `$${((runBResult.runCost?.totalUSD ?? 0)).toFixed(4)}`
            : key === "swarmObjective"
            ? runBResult.swarmPortfolio.objective.toFixed(3)
            : (runBResult.evalScore as unknown as Record<string, number>)[key];

          return (
            <>
              <div key={`${key}-l`} style={{ color: "#aaa", fontSize: 11 }}>{label}</div>
              <div key={`${key}-a`} style={{ color: "#ccc", fontSize: 11, textAlign: "center" }}>{String(aVal)}</div>
              <div key={`${key}-b`} style={{ color: "#ccc", fontSize: 11, textAlign: "center" }}>{String(bVal)}</div>
              <div key={`${key}-d`} style={{ color, fontWeight: 700, fontSize: 11, textAlign: "center" }}>
                {d > 0 ? "+" : ""}{typeof d === "number" && Math.abs(d) < 1 ? d.toFixed(3) : d}
              </div>
            </>
          );
        })}
      </div>

      {runAResult.selectedAgents.map((a) => a.id).sort().join(",") !== runBResult.selectedAgents.map((a) => a.id).sort().join(",") && (
        <div style={{ marginTop: 12, padding: "6px 10px", background: "rgba(0,170,255,0.08)", border: "1px solid rgba(0,170,255,0.2)", borderRadius: 4 }}>
          <div style={{ color: "#00aaff", fontSize: 10, marginBottom: 4 }}>SWARM CHANGE</div>
          <div style={{ color: "#888", fontSize: 11 }}>Run {runAResult.runNumber}: {runAResult.selectedAgents.map((a) => a.name).join(", ")}</div>
          <div style={{ color: "#ccc", fontSize: 11 }}>Run {runBResult.runNumber}: {runBResult.selectedAgents.map((a) => a.name).join(", ")}</div>
        </div>
      )}
    </div>
  );
}
