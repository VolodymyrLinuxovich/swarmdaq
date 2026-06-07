import { afterEach, describe, expect, it, vi } from "vitest";

describe("redis client fallback", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
    vi.resetModules();
  });

  it("is disabled when Upstash env vars are missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { isRedisEnabled, safeRedis } = await import("../redis/client");

    expect(isRedisEnabled()).toBe(false);
    await expect(safeRedis("missing", async () => "redis", "fallback")).resolves.toBe("fallback");
  });

  it("safeRedis returns fallback when Redis is disabled", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { safeRedis } = await import("../redis/client");
    const result = await safeRedis("test-op", async () => "should-not-run", "fallback-value");
    expect(result).toBe("fallback-value");
  });

  it("rawRedisCommand returns null when Redis is disabled", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { rawRedisCommand } = await import("../redis/client");
    const result = await rawRedisCommand(["TDIGEST.CREATE", "test:key", "COMPRESSION", "100"]);
    expect(result).toBeNull();
  });

  it("rawRedisCommand returns null for empty command", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { rawRedisCommand } = await import("../redis/client");
    const result = await rawRedisCommand([]);
    expect(result).toBeNull();
  });

  it("closeRedisClient resolves without error when Redis is disabled", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { closeRedisClient } = await import("../redis/client");
    await expect(closeRedisClient()).resolves.toBeUndefined();
  });

  it("getRedisClient returns null when Redis is disabled", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { getRedisClient } = await import("../redis/client");
    expect(getRedisClient()).toBeNull();
  });

  it("isRedisEnabled returns false when env vars are missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();

    const { isRedisEnabled } = await import("../redis/client");
    expect(isRedisEnabled()).toBe(false);
  });
});
