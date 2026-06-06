/**
 * T-Digest analytics helpers using Redis Stack's TDIGEST.* commands.
 *
 * @upstash/redis has no typed wrappers for TDIGEST, so we use the generic
 * redis.exec() method available on all @upstash/redis instances. If the
 * TDIGEST module is not loaded on the Redis tier (e.g., some non-Stack
 * Upstash plans), all functions catch the error, log a warning once, and
 * return null/undefined — never breaking mission runs.
 *
 * Requires Redis Stack ≥ 2.2 (TDIGEST module) or Upstash with Redis Stack.
 */

import { redis } from "./redis";

const DEFAULT_COMPRESSION = 100;

// Warn once per process start if TDIGEST is not available, not on every call.
let warned = false;
function warnOnce(msg: string) {
  if (warned) return;
  warned = true;
  console.warn("[tdigest]", msg);
}

/**
 * Ensure a t-digest sketch exists for the given key.
 * TDIGEST.CREATE is a no-op if the key already exists (error is swallowed).
 */
async function ensureSketch(key: string, compression: number): Promise<void> {
  try {
    await (redis as NonNullable<typeof redis>).exec([
      "TDIGEST.CREATE", key, "COMPRESSION", String(compression),
    ]);
  } catch {
    // Key already exists, or TDIGEST module not loaded — both are OK here.
    // Real errors surface on the subsequent ADD call.
  }
}

/** Add a single value into a t-digest sketch. No-op if Redis is unavailable. */
export async function addTDigestValue(
  key: string,
  value: number,
  compression = DEFAULT_COMPRESSION,
): Promise<void> {
  if (!redis) return;
  try {
    await ensureSketch(key, compression);
    await redis.exec(["TDIGEST.ADD", key, String(value)]);
  } catch (err) {
    warnOnce(`TDIGEST not available (${(err as Error).message?.slice(0, 60)}). Percentile analytics disabled.`);
  }
}

/** Add multiple values in a single TDIGEST.ADD call. No-op if empty or Redis unavailable. */
export async function addTDigestValues(
  key: string,
  values: number[],
  compression = DEFAULT_COMPRESSION,
): Promise<void> {
  if (!redis || values.length === 0) return;
  try {
    await ensureSketch(key, compression);
    await redis.exec(["TDIGEST.ADD", key, ...values.map(String)]);
  } catch (err) {
    warnOnce(`TDIGEST not available (${(err as Error).message?.slice(0, 60)}). Percentile analytics disabled.`);
  }
}

/**
 * Query quantile estimates from a t-digest sketch.
 * Returns an array of estimates in the same order as the input quantiles,
 * or null if the sketch is empty, doesn't exist, or TDIGEST is unavailable.
 */
export async function getTDigestQuantiles(
  key: string,
  quantiles: number[],
): Promise<number[] | null> {
  if (!redis || quantiles.length === 0) return null;
  try {
    const result = await redis.exec<(number | null)[]>([
      "TDIGEST.QUANTILE", key, ...quantiles.map(String),
    ]);
    if (!Array.isArray(result) || result.length !== quantiles.length) return null;
    const nums = result.map((v) => (v === null ? NaN : Number(v)));
    // Return null if any value is NaN (sketch empty or result undefined)
    return nums.some(isNaN) ? null : nums;
  } catch {
    return null;
  }
}

/**
 * Return the rank of a value in the sketch (0-indexed count of values ≤ value).
 * Returns null if the sketch is empty, doesn't exist, or TDIGEST is unavailable.
 */
export async function getTDigestRank(
  key: string,
  value: number,
): Promise<number | null> {
  if (!redis) return null;
  try {
    const result = await redis.exec<number | null>(["TDIGEST.RANK", key, String(value)]);
    return result === null ? null : Number(result);
  } catch {
    return null;
  }
}
