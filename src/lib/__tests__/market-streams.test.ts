import { describe, expect, it } from "vitest";
import { buildMarketEventStreamFields } from "../redis/streams";

describe("Redis market stream payloads", () => {
  it("serializes required stream fields", () => {
    const fields = buildMarketEventStreamFields({
      timestamp: 123,
      runId: "run-1",
      missionId: "mission-1",
      taskId: "task-1",
      agentId: "research",
      eventType: "agent_bid",
      mode: "LIVE",
      payload: { price: 0.05 },
    });

    expect(fields).toContain("timestamp");
    expect(fields).toContain("runId");
    expect(fields).toContain("missionId");
    expect(fields).toContain("taskId");
    expect(fields).toContain("agentId");
    expect(fields).toContain("eventType");
    expect(fields).toContain("mode");
    expect(fields).toContain("payload");
    expect(fields[fields.indexOf("payload") + 1]).toBe(JSON.stringify({ price: 0.05 }));
  });
});
