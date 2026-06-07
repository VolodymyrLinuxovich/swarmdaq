import { isRedisEnabled, rawRedisCommand } from "./client";
import { KEY } from "./keys";

const DEFAULT_COMPRESSION = 100;
const FALLBACK_SAMPLE_LIMIT = 1000;

type SupportState = "unknown" | "supported" | "unsupported";

const localSamples = new Map<string, number[]>();
let supportState: SupportState = "unknown";
let supportReason: string | null = null;

function clampQuantile(q: number): number {
  if (!Number.isFinite(q)) return 0;
  return Math.max(0, Math.min(1, q));
}

function rememberSample(key: string, value: number): void {
  if (!Number.isFinite(value)) return;
  const samples = localSamples.get(key) ?? [];
  samples.push(value);
  if (samples.length > FALLBACK_SAMPLE_LIMIT) samples.splice(0, samples.length - FALLBACK_SAMPLE_LIMIT);
  localSamples.set(key, samples);
}

async function persistFallbackSamples(key: string, values: number[]): Promise<void> {
  if (!isRedisEnabled() || values.length === 0) return;
  await rawRedisCommand(["LPUSH", KEY.tdigestFallbackSamples(key), ...values.map(String)]);
  await rawRedisCommand(["LTRIM", KEY.tdigestFallbackSamples(key), 0, FALLBACK_SAMPLE_LIMIT - 1]);
}

async function readFallbackSamples(key: string): Promise<number[]> {
  const memory = localSamples.get(key) ?? [];
  if (!isRedisEnabled()) return memory;
  const raw = await rawRedisCommand<unknown[]>(["LRANGE", KEY.tdigestFallbackSamples(key), 0, FALLBACK_SAMPLE_LIMIT - 1]);
  if (!Array.isArray(raw)) return memory;
  const fromRedis = raw.map(Number).filter(Number.isFinite);
  return fromRedis.length > 0 ? fromRedis : memory;
}

function quantilesFromSamples(samples: number[], quantiles: number[]): number[] | null {
  if (samples.length === 0 || quantiles.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return quantiles.map((q) => {
    const idx = clampQuantile(q) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const ratio = idx - lo;
    return sorted[lo] * (1 - ratio) + sorted[hi] * ratio;
  });
}

function cdfFromSamples(samples: number[], value: number): number | null {
  if (samples.length === 0 || !Number.isFinite(value)) return null;
  const le = samples.filter((sample) => sample <= value).length;
  return le / samples.length;
}

function parseInfo(raw: unknown): { sampleSize: number | null } {
  if (!Array.isArray(raw)) return { sampleSize: null };
  const fields: Record<string, number> = {};
  for (let i = 0; i < raw.length; i += 2) {
    const key = String(raw[i] ?? "").toLowerCase();
    const value = Number(raw[i + 1]);
    if (key && Number.isFinite(value)) fields[key] = value;
  }
  const sampleSize =
    fields.observations ??
    fields["merged weight"] ??
    ((fields["merged nodes"] ?? 0) + (fields["unmerged nodes"] ?? 0) || undefined);
  return { sampleSize: sampleSize ?? null };
}

async function ensureTDigestSupport(compression = DEFAULT_COMPRESSION): Promise<boolean> {
  if (!isRedisEnabled()) {
    supportState = "unsupported";
    supportReason = "Redis env vars are missing";
    return false;
  }
  if (supportState !== "unknown") return supportState === "supported";

  await rawRedisCommand<string>([
    "TDIGEST.CREATE",
    KEY.tdigestProbe,
    "COMPRESSION",
    compression,
  ]);

  const add = await rawRedisCommand<string>(["TDIGEST.ADD", KEY.tdigestProbe, 0]);
  if (add === null) {
    supportState = "unsupported";
    supportReason = "TDIGEST.ADD failed";
    return false;
  }

  supportState = "supported";
  supportReason = null;
  return true;
}

async function ensureSketch(key: string, compression: number): Promise<boolean> {
  const supported = await ensureTDigestSupport(compression);
  if (!supported) return false;
  await rawRedisCommand(["TDIGEST.CREATE", key, "COMPRESSION", compression]);
  return true;
}

export async function isTDigestSupported(): Promise<boolean> {
  return ensureTDigestSupport();
}

export async function getTDigestRuntimeStatus(): Promise<{
  redisEnabled: boolean;
  tdigestEnabled: boolean;
  mode: "redis-tdigest" | "rolling-quantile" | "in-memory";
  reason: string | null;
}> {
  const tdigestEnabled = await ensureTDigestSupport();
  return {
    redisEnabled: isRedisEnabled(),
    tdigestEnabled,
    mode: tdigestEnabled ? "redis-tdigest" : isRedisEnabled() ? "rolling-quantile" : "in-memory",
    reason: tdigestEnabled ? null : supportReason,
  };
}

export async function addTDigestValue(
  key: string,
  value: number,
  compression = DEFAULT_COMPRESSION,
): Promise<void> {
  if (!Number.isFinite(value)) return;
  const supported = await ensureSketch(key, compression);
  if (supported) {
    const added = await rawRedisCommand(["TDIGEST.ADD", key, value]);
    if (added !== null) return;
    supportState = "unsupported";
    supportReason = "TDIGEST.ADD failed after feature detection";
  }
  rememberSample(key, value);
  await persistFallbackSamples(key, [value]);
}

export async function addTDigestValues(
  key: string,
  values: number[],
  compression = DEFAULT_COMPRESSION,
): Promise<void> {
  const clean = values.filter(Number.isFinite);
  if (clean.length === 0) return;
  const supported = await ensureSketch(key, compression);
  if (supported) {
    const added = await rawRedisCommand(["TDIGEST.ADD", key, ...clean]);
    if (added !== null) return;
    supportState = "unsupported";
    supportReason = "TDIGEST.ADD failed after feature detection";
  }
  clean.forEach((value) => rememberSample(key, value));
  await persistFallbackSamples(key, clean);
}

export async function getTDigestQuantiles(
  key: string,
  quantiles: number[],
): Promise<number[] | null> {
  if (quantiles.length === 0) return null;
  if (await ensureTDigestSupport()) {
    const result = await rawRedisCommand<(number | string | null)[]>([
      "TDIGEST.QUANTILE",
      key,
      ...quantiles.map(String),
    ]);
    if (Array.isArray(result) && result.length === quantiles.length) {
      const nums = result.map((v) => (v === null ? NaN : Number(v)));
      if (!nums.some(Number.isNaN)) return nums;
    }
  }
  return quantilesFromSamples(await readFallbackSamples(key), quantiles);
}

export async function getTDigestCDF(key: string, value: number): Promise<number | null> {
  if (!Number.isFinite(value)) return null;
  if (await ensureTDigestSupport()) {
    const result = await rawRedisCommand<number[] | number | string[]>(["TDIGEST.CDF", key, value]);
    if (Array.isArray(result) && result.length > 0) {
      const n = Number(result[0]);
      if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
    }
    const n = Number(result);
    if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
  }
  return cdfFromSamples(await readFallbackSamples(key), value);
}

export async function getTDigestRank(key: string, value: number): Promise<number | null> {
  if (!Number.isFinite(value)) return null;
  if (await ensureTDigestSupport()) {
    const result = await rawRedisCommand<number | string | null>(["TDIGEST.RANK", key, value]);
    if (result !== null) {
      const n = Number(result);
      if (Number.isFinite(n)) return n;
    }
  }
  const samples = await readFallbackSamples(key);
  if (samples.length === 0) return null;
  return samples.filter((sample) => sample <= value).length;
}

export async function getTDigestInfo(key: string): Promise<{ sampleSize: number | null }> {
  if (await ensureTDigestSupport()) {
    const info = parseInfo(await rawRedisCommand<unknown[]>(["TDIGEST.INFO", key]));
    if (info.sampleSize !== null) return info;
  }
  return { sampleSize: (await readFallbackSamples(key)).length };
}

export function resetLocalTDigestFallback(): void {
  localSamples.clear();
  supportState = "unknown";
  supportReason = null;
}

// ── Named domain helpers ───────────────────────────────────────────────────

export type TDigestFallbackMode = "native" | "redis-list" | "local-memory" | "disabled";

export async function getTDigestFallbackMode(): Promise<TDigestFallbackMode> {
  if (!isRedisEnabled()) return "disabled";
  const supported = await ensureTDigestSupport();
  return supported ? "native" : "redis-list";
}

export async function ensureTDigest(key: string, compression = DEFAULT_COMPRESSION): Promise<void> {
  await ensureSketch(key, compression);
}

export async function recordBidPrice(taskType: string, price: number): Promise<void> {
  await addTDigestValue(KEY.tdigestBidPriceTask(taskType), price);
}

export async function recordClearingPrice(taskType: string, price: number): Promise<void> {
  await Promise.all([
    addTDigestValue(KEY.tdigestPriceTask(taskType), price),
    addTDigestValue(KEY.tdigestPriceGlobal, price),
  ]);
}

export async function recordLatency(ms: number): Promise<void> {
  await addTDigestValue(KEY.tdigestLatencyGlobal, ms);
}

export async function recordScoreDelta(delta: number): Promise<void> {
  await addTDigestValue(KEY.tdigestScoreDeltaGlobal, delta);
}

export async function recordCostQuality(costPerQualityPoint: number): Promise<void> {
  await addTDigestValue(KEY.tdigestCostQualityGlobal, costPerQualityPoint);
}

export async function getQuantiles(
  key: string,
): Promise<{ p50: number | null; p90: number | null; p95: number | null; p99: number | null }> {
  const result = await getTDigestQuantiles(key, [0.5, 0.9, 0.95, 0.99]);
  return {
    p50: result?.[0] ?? null,
    p90: result?.[1] ?? null,
    p95: result?.[2] ?? null,
    p99: result?.[3] ?? null,
  };
}

export async function estimateCDF(key: string, value: number): Promise<number | null> {
  return getTDigestCDF(key, value);
}

export async function getDigestInfo(key: string): Promise<{ sampleSize: number | null }> {
  return getTDigestInfo(key);
}
