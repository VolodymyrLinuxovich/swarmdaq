import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMocks = vi.hoisted(() => ({
  isRedisEnabled: vi.fn(),
  rawRedisCommand: vi.fn(),
}));

vi.mock("../redis/client", () => redisMocks);

import {
  addTDigestValue,
  addTDigestValues,
  getTDigestCDF,
  getTDigestQuantiles,
  getTDigestRank,
  getTDigestRuntimeStatus,
  resetLocalTDigestFallback,
} from "../tdigest";

describe("redis t-digest wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLocalTDigestFallback();
    redisMocks.isRedisEnabled.mockReturnValue(true);
    redisMocks.rawRedisCommand.mockResolvedValue("OK");
  });

  it("feature-detects TDIGEST and writes values when supported", async () => {
    await addTDigestValue("test:key", 75);

    expect(redisMocks.rawRedisCommand).toHaveBeenCalledWith(["TDIGEST.CREATE", "swarmdaq:tdigest:probe", "COMPRESSION", 100]);
    expect(redisMocks.rawRedisCommand).toHaveBeenCalledWith(["TDIGEST.ADD", "swarmdaq:tdigest:probe", 0]);
    expect(redisMocks.rawRedisCommand).toHaveBeenCalledWith(["TDIGEST.CREATE", "test:key", "COMPRESSION", 100]);
    expect(redisMocks.rawRedisCommand).toHaveBeenCalledWith(["TDIGEST.ADD", "test:key", 75]);
  });

  it("batches values in a single TDIGEST.ADD call", async () => {
    await addTDigestValues("test:key", [70, 80, 90]);
    expect(redisMocks.rawRedisCommand).toHaveBeenCalledWith(["TDIGEST.ADD", "test:key", 70, 80, 90]);
  });

  it("uses rolling quantile fallback when TDIGEST is unsupported", async () => {
    redisMocks.rawRedisCommand.mockResolvedValue(null);

    await addTDigestValues("fallback:key", [10, 20, 30, 40, 50]);
    const quantiles = await getTDigestQuantiles("fallback:key", [0.5, 0.9]);
    const cdf = await getTDigestCDF("fallback:key", 30);

    expect(quantiles?.[0]).toBe(30);
    expect(quantiles?.[1]).toBeCloseTo(46, 5);
    expect(cdf).toBe(0.6);
  });

  it("returns rank from Redis when TDIGEST is supported", async () => {
    redisMocks.rawRedisCommand
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce("OK")
      .mockResolvedValueOnce(3);

    expect(await getTDigestRank("test:key", 85)).toBe(3);
  });

  it("reports rolling-quantile mode when Redis lacks TDIGEST", async () => {
    redisMocks.rawRedisCommand.mockResolvedValue(null);
    const status = await getTDigestRuntimeStatus();
    expect(status).toMatchObject({
      redisEnabled: true,
      tdigestEnabled: false,
      mode: "rolling-quantile",
    });
  });

  it("reports in-memory mode when Redis env vars are missing", async () => {
    redisMocks.isRedisEnabled.mockReturnValue(false);
    const status = await getTDigestRuntimeStatus();
    expect(status).toMatchObject({
      redisEnabled: false,
      tdigestEnabled: false,
      mode: "in-memory",
    });
  });
});
