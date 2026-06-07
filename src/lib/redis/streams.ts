import type { ExecMode } from "../mode";
import { isRedisEnabled, rawRedisCommand } from "./client";
import { KEY } from "./keys";

export type MarketEventType =
  | "mission_created"
  | "task_created"
  | "agent_bid"
  | "marketmaker_selection"
  | "task_completed"
  | "evaluation_completed"
  | "reputation_updated"
  | "anomaly_detected"
  | "run_completed"
  | "redis_error"
  | "mem0_memory_saved"
  | "mem0_memory_retrieved";

export interface RedisMarketEvent {
  id?: string;
  timestamp: number;
  runId: string;
  missionId: string;
  taskId?: string;
  agentId?: string;
  eventType: MarketEventType;
  mode: ExecMode | "LIVE_MODE" | "SEEDED_DEMO_MODE" | "FALLBACK_MODE";
  payload: Record<string, unknown>;
}

const inMemoryStreams = new Map<string, RedisMarketEvent[]>();

function compactPayload(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  return json.length > 3500 ? `${json.slice(0, 3500)}...` : json;
}

export function buildMarketEventStreamFields(event: RedisMarketEvent): string[] {
  return [
    "timestamp",
    String(event.timestamp),
    "runId",
    event.runId,
    "missionId",
    event.missionId,
    "taskId",
    event.taskId ?? "",
    "agentId",
    event.agentId ?? "",
    "eventType",
    event.eventType,
    "mode",
    event.mode,
    "payload",
    compactPayload(event.payload),
  ];
}

function remember(key: string, event: RedisMarketEvent): void {
  const list = inMemoryStreams.get(key) ?? [];
  list.unshift(event);
  if (list.length > 500) list.pop();
  inMemoryStreams.set(key, list);
}

function parseStreamFields(fields: unknown): Record<string, string> {
  if (Array.isArray(fields)) {
    const out: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const k = String(fields[i] ?? "");
      if (!k) continue;
      out[k] = String(fields[i + 1] ?? "");
    }
    return out;
  }
  if (fields && typeof fields === "object") {
    return Object.fromEntries(
      Object.entries(fields as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
    );
  }
  return {};
}

function parseStreamEntry(entry: unknown): RedisMarketEvent | null {
  if (!Array.isArray(entry) || entry.length < 2) return null;
  const id = String(entry[0] ?? "");
  const fields = parseStreamFields(entry[1]);
  if (!fields.eventType || !fields.missionId || !fields.runId) return null;
  let payload: Record<string, unknown> = {};
  try {
    payload = fields.payload ? JSON.parse(fields.payload) as Record<string, unknown> : {};
  } catch {
    payload = { raw: fields.payload };
  }
  return {
    id,
    timestamp: Number(fields.timestamp) || Date.now(),
    runId: fields.runId,
    missionId: fields.missionId,
    taskId: fields.taskId || undefined,
    agentId: fields.agentId || undefined,
    eventType: fields.eventType as MarketEventType,
    mode: fields.mode as RedisMarketEvent["mode"],
    payload,
  };
}

export async function appendMarketEvent(event: Omit<RedisMarketEvent, "timestamp"> & { timestamp?: number }): Promise<void> {
  const fullEvent: RedisMarketEvent = { timestamp: Date.now(), ...event };
  remember(KEY.streamMarketEvents, fullEvent);
  if (!isRedisEnabled()) return;
  await rawRedisCommand([
    "XADD",
    KEY.streamMarketEvents,
    "MAXLEN",
    "~",
    5000,
    "*",
    ...buildMarketEventStreamFields(fullEvent),
  ]);
}

export async function appendEvaluationEvent(event: Omit<RedisMarketEvent, "timestamp"> & { timestamp?: number }): Promise<void> {
  const fullEvent: RedisMarketEvent = { timestamp: Date.now(), ...event };
  remember(KEY.streamEvaluations, fullEvent);
  if (!isRedisEnabled()) return;
  await rawRedisCommand([
    "XADD",
    KEY.streamEvaluations,
    "MAXLEN",
    "~",
    3000,
    "*",
    ...buildMarketEventStreamFields(fullEvent),
  ]);
}

export async function getStreamLength(key = KEY.streamMarketEvents): Promise<number> {
  if (!isRedisEnabled()) return inMemoryStreams.get(key)?.length ?? 0;
  const len = await rawRedisCommand<number>(["XLEN", key]);
  return typeof len === "number" ? len : inMemoryStreams.get(key)?.length ?? 0;
}

export async function getRecentMarketEvents(limit = 20, key = KEY.streamMarketEvents): Promise<RedisMarketEvent[]> {
  if (!isRedisEnabled()) return (inMemoryStreams.get(key) ?? []).slice(0, limit);
  const result = await rawRedisCommand<unknown[]>(["XREVRANGE", key, "+", "-", "COUNT", limit]);
  if (!Array.isArray(result)) return (inMemoryStreams.get(key) ?? []).slice(0, limit);
  return result.map(parseStreamEntry).filter((event): event is RedisMarketEvent => event !== null);
}

export function clearInMemoryStreams(): void {
  inMemoryStreams.clear();
}
