import { createClient } from "redis";

// Use the inferred return type of createClient directly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RedisClient = ReturnType<typeof createClient<any, any, any>>;

// ── Connection config ─────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
const REDIS_USERNAME = process.env.REDIS_USERNAME ?? "default";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_TLS = process.env.REDIS_TLS === "true";

const hasConfig = Boolean(REDIS_URL || REDIS_HOST);

const devWarnings = new Set<string>();
function warnDevOnce(key: string, msg: string): void {
  if (process.env.NODE_ENV === "production" || devWarnings.has(key)) return;
  devWarnings.add(key);
  console.warn(msg);
}

if (!hasConfig) {
  warnDevOnce("redis-disabled", "Redis disabled: missing REDIS_URL or REDIS_HOST/REDIS_PASSWORD");
}

// ── Lazy singleton connection ─────────────────────────────────────────────────

let _client: RedisClient | null = null;
let _pending: Promise<RedisClient | null> | null = null;

function reconnectStrategy(retries: number): number {
  return Math.min(retries * 50, 2000);
}

function createRedisClient(): RedisClient {
  if (REDIS_URL) {
    return createClient({
      url: REDIS_URL,
      socket: { reconnectStrategy, ...(REDIS_TLS ? { tls: true as const } : {}) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;
  }
  return createClient({
    socket: {
      host: REDIS_HOST ?? "localhost",
      port: REDIS_PORT,
      reconnectStrategy,
      ...(REDIS_TLS ? { tls: true as const } : {}),
    },
    username: REDIS_USERNAME,
    password: REDIS_PASSWORD,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
}

async function connectClient(): Promise<RedisClient | null> {
  if (!hasConfig) return null;
  if (_client?.isReady) return _client;
  if (_pending) return _pending;

  _pending = (async () => {
    try {
      const client = createRedisClient();
      client.on("error", (err: Error) => {
        warnDevOnce("redis-err", `[redis] ${err.message}`);
      });
      await client.connect();
      _client = client;
      return client;
    } catch (err) {
      warnDevOnce("redis-connect", `[redis] connect failed: ${(err as Error).message}`);
      return null;
    } finally {
      _pending = null;
    }
  })();

  return _pending;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isRedisEnabled(): boolean {
  return hasConfig;
}

export function isRedisAvailable(): boolean {
  return hasConfig;
}

export function getRedisClient(): RedisClient | null {
  return _client?.isReady ? _client : null;
}

export async function closeRedisClient(): Promise<void> {
  if (_client) {
    try { await _client.disconnect(); } catch { /* ignore */ }
    _client = null;
  }
  _pending = null;
}

export async function safeRedis<T>(
  label: string,
  op: (client: RedisClient) => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!hasConfig) return fallback;
  try {
    const client = await connectClient();
    if (!client) return fallback;
    return await op(client);
  } catch (err) {
    warnDevOnce(`redis-op-${label}`, `[redis] ${label} failed: ${(err as Error).message}`);
    return fallback;
  }
}

export async function rawRedisCommand<T = unknown>(
  command: Array<string | number>,
): Promise<T | null> {
  if (!hasConfig || command.length === 0) return null;
  const strCmd = command.map(String);
  return safeRedis<T | null>(
    strCmd[0].toLowerCase(),
    async (client) => client.sendCommand(strCmd) as Promise<T>,
    null,
  );
}

export async function getRedisRuntimeStatus(): Promise<{ enabled: boolean; ping: boolean }> {
  if (!hasConfig) return { enabled: false, ping: false };
  const pong = await safeRedis("ping", (client) => client.ping(), null);
  return { enabled: true, ping: pong === "PONG" };
}

// Backward-compat stub — callers should use safeRedis() or isRedisEnabled()
export const redis: null = null;
