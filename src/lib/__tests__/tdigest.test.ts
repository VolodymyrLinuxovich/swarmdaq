import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock redis module before importing tdigest so the singleton is replaced
vi.mock("../redis", () => ({
  redis: { exec: vi.fn() },
  KEY: {
    tdScoreOverall: "swarmdaq:td:score:overall",
    tdScoreDimension: (d: string) => `swarmdaq:td:score:${d}`,
    tdAgentScore: (id: string) => `swarmdaq:td:agent:${id}:score`,
    tdAgentDelta: (id: string) => `swarmdaq:td:agent:${id}:delta`,
    tdLatencyGlobal: "swarmdaq:td:latency:global",
    tdLatencyModel: (m: string) => `swarmdaq:td:latency:model:${m}`,
  },
}));

import { addTDigestValue, addTDigestValues, getTDigestQuantiles, getTDigestRank } from "../tdigest";
import { redis } from "../redis";

const mockExec = () => vi.mocked((redis as NonNullable<typeof redis>).exec);

describe("addTDigestValue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls TDIGEST.CREATE then TDIGEST.ADD", async () => {
    mockExec().mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
    await addTDigestValue("test:key", 75);
    expect(mockExec()).toHaveBeenCalledWith(["TDIGEST.CREATE", "test:key", "COMPRESSION", "100"]);
    expect(mockExec()).toHaveBeenCalledWith(["TDIGEST.ADD", "test:key", "75"]);
  });

  it("uses custom compression", async () => {
    mockExec().mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
    await addTDigestValue("test:key", 80, 200);
    expect(mockExec()).toHaveBeenCalledWith(["TDIGEST.CREATE", "test:key", "COMPRESSION", "200"]);
  });

  it("fails soft when TDIGEST is unavailable — does not throw", async () => {
    mockExec().mockRejectedValue(new Error("ERR unknown command TDIGEST.CREATE"));
    await expect(addTDigestValue("test:key", 75)).resolves.toBeUndefined();
  });

  it("fails soft when ADD fails — does not throw", async () => {
    mockExec()
      .mockResolvedValueOnce("OK")           // CREATE succeeds
      .mockRejectedValue(new Error("ERR"));  // ADD fails
    await expect(addTDigestValue("test:key", 75)).resolves.toBeUndefined();
  });
});

describe("addTDigestValues", () => {
  beforeEach(() => vi.clearAllMocks());

  it("batches all values in a single TDIGEST.ADD call", async () => {
    mockExec().mockResolvedValueOnce("OK").mockResolvedValueOnce("OK");
    await addTDigestValues("test:key", [70, 80, 90, 95]);
    expect(mockExec()).toHaveBeenCalledWith(["TDIGEST.ADD", "test:key", "70", "80", "90", "95"]);
  });

  it("is a no-op for an empty array", async () => {
    await addTDigestValues("test:key", []);
    expect(mockExec()).not.toHaveBeenCalled();
  });

  it("fails soft on error", async () => {
    mockExec().mockRejectedValue(new Error("ERR"));
    await expect(addTDigestValues("test:key", [1, 2, 3])).resolves.toBeUndefined();
  });
});

describe("getTDigestQuantiles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed numeric array", async () => {
    mockExec().mockResolvedValueOnce([82.5, 91.0, 95.0]);
    const result = await getTDigestQuantiles("test:key", [0.5, 0.9, 0.95]);
    expect(result).toEqual([82.5, 91.0, 95.0]);
  });

  it("returns null when sketch is empty (null values in result)", async () => {
    mockExec().mockResolvedValueOnce([null, null, null]);
    const result = await getTDigestQuantiles("test:key", [0.5, 0.9, 0.95]);
    expect(result).toBeNull();
  });

  it("returns null on command error", async () => {
    mockExec().mockRejectedValue(new Error("ERR key does not exist"));
    expect(await getTDigestQuantiles("test:key", [0.5])).toBeNull();
  });

  it("returns null for empty quantile list", async () => {
    expect(await getTDigestQuantiles("test:key", [])).toBeNull();
    expect(mockExec()).not.toHaveBeenCalled();
  });

  it("returns null when result length does not match", async () => {
    mockExec().mockResolvedValueOnce([85.0]); // only 1 value for 3 quantiles
    expect(await getTDigestQuantiles("test:key", [0.5, 0.9, 0.95])).toBeNull();
  });
});

describe("getTDigestRank", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns numeric rank", async () => {
    mockExec().mockResolvedValueOnce(3);
    expect(await getTDigestRank("test:key", 85)).toBe(3);
  });

  it("returns null when result is null", async () => {
    mockExec().mockResolvedValueOnce(null);
    expect(await getTDigestRank("test:key", 85)).toBeNull();
  });

  it("returns null on command error", async () => {
    mockExec().mockRejectedValue(new Error("ERR key does not exist"));
    expect(await getTDigestRank("test:key", 85)).toBeNull();
  });
});
