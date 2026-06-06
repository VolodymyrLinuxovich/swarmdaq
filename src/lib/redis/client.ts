import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const devWarnings = new Set<string>();

function warnDevOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === "production" || devWarnings.has(key)) return;
  devWarnings.add(key);
  console.warn(message);
}

export const redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : null;

if (!redis) {
  warnDevOnce(
    "redis-env-missing",
    "[redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing; using in-memory market memory.",
  );
}

export function isRedisEnabled(): boolean {
  return redis !== null;
}

export function isRedisAvailable(): boolean {
  return isRedisEnabled();
}

export async function safeRedis<T>(
  label: string,
  op: (client: NonNullable<typeof redis>) => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!redis) return fallback;
  try {
    return await op(redis);
  } catch (err) {
    warnDevOnce(
      `redis-op-${label}`,
      `[redis] ${label} failed; falling back without Redis. ${(err as Error).message ?? String(err)}`,
    );
    return fallback;
  }
}

export async function rawRedisCommand<T = unknown>(
  command: Array<string | number>,
): Promise<T | null> {
  const [name, ...args] = command;
  if (!name) return null;
  return safeRedis<T | null>(
    name.toString().toLowerCase(),
    async (client) => client.exec<T>([String(name), ...args]),
    null,
  );
}

export async function getRedisRuntimeStatus(): Promise<{
  enabled: boolean;
  ping: boolean;
}> {
  if (!redis) return { enabled: false, ping: false };
  const pong = await safeRedis("ping", (client) => client.ping(), null);
  return { enabled: true, ping: pong === "PONG" };
}
