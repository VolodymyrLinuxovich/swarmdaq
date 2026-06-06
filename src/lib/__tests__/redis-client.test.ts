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
});
