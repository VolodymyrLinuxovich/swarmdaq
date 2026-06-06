"use client";
import type { MissionEvent } from "@/lib/marketHistory";
import type { MissionResult } from "@/lib/types";

export function MissionReplayCard({ mission, events }: { mission: MissionResult; events: MissionEvent[] }) {
  const eventColors: Record<string, string> = {
    mission_received: "#00aaff",
    swarm_selected: "#00ff88",
    agent_started: "#888",
    agent_completed: "#888",
    reputation_updated: "#fbbf24",
    mission_completed: "#00ff88",
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#e0e0e0", padding: "12px 0" }}>
      <div style={{ color: "#00ff88", fontWeight: 700, marginBottom: 8, fontSize: 13, letterSpacing: 1 }}>
        MISSION REPLAY — RUN #{mission.runNumber}
      </div>
      <div style={{ color: "#888", marginBottom: 10, fontSize: 11 }}>
        {mission.mission.slice(0, 100)}{mission.mission.length > 100 ? "…" : ""}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
        {(["quality", "factuality", "actionability"] as const).map((k) => (
          <div key={k} style={{ background: "rgba(0,255,136,0.07)", borderRadius: 4, padding: "4px 8px", textAlign: "center" }}>
            <div style={{ color: "#888", fontSize: 10 }}>{k.toUpperCase()}</div>
            <div style={{ color: "#00ff88", fontWeight: 700, fontSize: 16 }}>{mission.evalScore[k]}</div>
          </div>
        ))}
      </div>

      <div style={{ color: "#888", fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>EVENT TIMELINE</div>
      <div style={{ maxHeight: 200, overflowY: "auto", borderLeft: "2px solid rgba(0,255,136,0.15)", paddingLeft: 10 }}>
        {events.map((ev, i) => (
          <div key={i} style={{ marginBottom: 6, color: eventColors[ev.eventType] ?? "#ccc" }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 1 }}>
              {new Date(ev.timestamp).toISOString().slice(11, 19)}
            </div>
            <div style={{ fontSize: 11 }}>{ev.message}</div>
          </div>
        ))}
        {events.length === 0 && (
          <div style={{ color: "#555", fontSize: 11 }}>No events stored for this mission.</div>
        )}
      </div>

      {mission.reputationChanges.length > 0 && (
        <>
          <div style={{ color: "#888", fontSize: 10, marginTop: 12, marginBottom: 6, letterSpacing: 1 }}>REPUTATION OUTCOME</div>
          {mission.reputationChanges.map((c) => (
            <div key={c.agentId} style={{ display: "flex", gap: 8, marginBottom: 4, fontSize: 11 }}>
              <span style={{ color: "#ccc", flex: 1 }}>{c.agentName}</span>
              <span style={{ color: c.delta > 0 ? "#00ff88" : c.delta < 0 ? "#ef4444" : "#888", fontWeight: 700 }}>
                {c.delta > 0 ? "+" : ""}{c.delta}
              </span>
              <span style={{ color: "#555", fontSize: 10 }}>{c.reason.slice(0, 50)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
