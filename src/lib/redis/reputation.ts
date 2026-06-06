import type { Agent } from "../types";
import { redis, safeRedis } from "./client";
import { KEY } from "./keys";

type HashRecord = Record<string, unknown>;

const NUMERIC_FIELDS = [
  "price",
  "reputation",
  "factuality",
  "usefulness",
  "collaboration",
  "latencyAvg",
  "alpha",
  "beta",
  "bayesianMean",
  "wins",
  "losses",
  "meanReward",
  "uncertainty",
  "avgLatency",
  "avgCost",
  "runs",
  "elo",
  "ucbScore",
  "graphTrust",
  "lastUpdated",
] as const;

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseSkills(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string") ? parsed : fallback;
  } catch {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

function serializeAgent(agent: Agent): Record<string, string> {
  const lastUpdated = Date.now();
  return {
    agentId: agent.id,
    id: agent.id,
    name: agent.name,
    role: agent.role,
    provider: agent.provider ?? "gemini",
    skills: JSON.stringify(agent.skills),
    status: agent.status,
    price: String(agent.price),
    reputation: String(agent.reputation),
    elo: String(agent.elo),
    alpha: String(agent.alpha),
    beta: String(agent.beta),
    bayesianMean: String(agent.bayesianMean),
    wins: String(agent.wins),
    losses: String(agent.losses),
    meanReward: String(agent.meanReward),
    uncertainty: String(agent.uncertainty),
    factuality: String(agent.factuality),
    usefulness: String(agent.usefulness),
    collaboration: String(agent.collaboration),
    latencyAvg: String(agent.latencyAvg),
    avgLatency: String(agent.latencyAvg),
    avgCost: String(agent.price),
    runs: String(agent.runs),
    ucbScore: String(agent.ucbScore),
    graphTrust: String(agent.graphTrust),
    lastUpdated: String(lastUpdated),
  };
}

export function agentFromHash(agentId: string, hash: HashRecord, fallback?: Agent): Agent | null {
  if (!hash || Object.keys(hash).length === 0) return null;
  const id = String(hash.agentId ?? hash.id ?? agentId);
  const base = fallback;
  const status = String(hash.status ?? base?.status ?? "idle") as Agent["status"];
  const provider = String(hash.provider ?? base?.provider ?? "gemini") as Agent["provider"];

  return {
    id,
    name: String(hash.name ?? base?.name ?? id),
    role: String(hash.role ?? base?.role ?? "Market participant"),
    provider,
    skills: parseSkills(hash.skills, base?.skills ?? []),
    price: parseNumber(hash.price, base?.price ?? 0.01),
    reputation: parseNumber(hash.reputation, base?.reputation ?? 70),
    factuality: parseNumber(hash.factuality, base?.factuality ?? 0.7),
    usefulness: parseNumber(hash.usefulness, base?.usefulness ?? 0.7),
    collaboration: parseNumber(hash.collaboration, base?.collaboration ?? 0.7),
    latencyAvg: parseNumber(hash.latencyAvg ?? hash.avgLatency, base?.latencyAvg ?? 1),
    status,
    alpha: parseNumber(hash.alpha, base?.alpha ?? 2),
    beta: parseNumber(hash.beta, base?.beta ?? 1),
    meanReward: parseNumber(hash.meanReward, base?.meanReward ?? 0.7),
    uncertainty: parseNumber(hash.uncertainty, base?.uncertainty ?? 0.1),
    runs: parseNumber(hash.runs, base?.runs ?? 0),
    wins: parseNumber(hash.wins, base?.wins ?? 0),
    losses: parseNumber(hash.losses, base?.losses ?? 0),
    elo: parseNumber(hash.elo, base?.elo ?? 1450),
    ucbScore: parseNumber(hash.ucbScore, base?.ucbScore ?? 0),
    graphTrust: parseNumber(hash.graphTrust, base?.graphTrust ?? 0.5),
    bayesianMean: parseNumber(hash.bayesianMean, base?.bayesianMean ?? 0.7),
  };
}

export function agentReputationSnapshot(agent: Agent): Record<string, string | number> {
  const hash = serializeAgent(agent);
  return Object.fromEntries(
    Object.entries(hash).filter(([key]) =>
      key === "agentId" ||
      key === "role" ||
      key === "lastUpdated" ||
      NUMERIC_FIELDS.includes(key as (typeof NUMERIC_FIELDS)[number])
    ),
  );
}

export function computeAgentMarketValue(agent: Agent): number {
  return (
    agent.reputation * 0.35 +
    agent.elo / 20 +
    agent.bayesianMean * 30 +
    agent.factuality * 20 +
    agent.collaboration * 10 -
    agent.price * 120 -
    agent.uncertainty * 25
  );
}

export async function updateAgentLeaderboards(agent: Agent): Promise<void> {
  if (!redis) return;
  await safeRedis("updateAgentLeaderboards", async (client) => {
    await Promise.all([
      client.zadd(KEY.agentLeaderboardReputation, { score: agent.reputation, member: agent.id }),
      client.zadd(KEY.agentLeaderboardElo, { score: agent.elo, member: agent.id }),
      client.zadd(KEY.agentLeaderboardFactuality, { score: agent.factuality * 100, member: agent.id }),
      client.zadd(KEY.agentLeaderboardBayesian, { score: agent.bayesianMean * 1000, member: agent.id }),
      client.zadd(KEY.agentLeaderboardUncertainty, { score: (1 - agent.uncertainty) * 100, member: agent.id }),
      client.zadd(KEY.agentLeaderboardMarketValue, { score: computeAgentMarketValue(agent), member: agent.id }),
    ]);
  }, undefined);
}

async function writeHashWithMigration(agent: Agent): Promise<boolean> {
  if (!redis) return false;
  const key = KEY.agent(agent.id);
  const hash = serializeAgent(agent);
  try {
    await redis.hset(key, hash);
  } catch (err) {
    const message = (err as Error).message ?? "";
    if (!message.toLowerCase().includes("wrongtype")) throw err;
    await redis.del(key);
    await redis.hset(key, hash);
  }
  await updateAgentLeaderboards(agent);
  return true;
}

export async function writeAgentState(agent: Agent): Promise<boolean> {
  return safeRedis("writeAgentState", () => writeHashWithMigration(agent), false);
}

export async function readAgentState(agentId: string, fallback?: Agent): Promise<Agent | null> {
  if (!redis) return null;
  const key = KEY.agent(agentId);

  const fromHash = await safeRedis<Agent | null>(
    "readAgentHash",
    async (client) => {
      const hash = await client.hgetall<HashRecord>(key);
      return hash ? agentFromHash(agentId, hash, fallback) : null;
    },
    null,
  );
  if (fromHash) return fromHash;

  return safeRedis<Agent | null>(
    "readLegacyAgentJson",
    async (client) => {
      const legacy = await client.get<Agent>(key);
      if (!legacy || typeof legacy !== "object") return null;
      await writeHashWithMigration(legacy);
      return legacy;
    },
    null,
  );
}

export async function deleteAgentState(agentId: string): Promise<boolean> {
  if (!redis) return false;
  return safeRedis(
    "deleteAgentState",
    async (client) => {
      await Promise.all([
        client.del(KEY.agent(agentId)),
        client.zrem(KEY.agentLeaderboardReputation, agentId),
        client.zrem(KEY.agentLeaderboardElo, agentId),
        client.zrem(KEY.agentLeaderboardFactuality, agentId),
        client.zrem(KEY.agentLeaderboardBayesian, agentId),
        client.zrem(KEY.agentLeaderboardUncertainty, agentId),
        client.zrem(KEY.agentLeaderboardMarketValue, agentId),
      ]);
      return true;
    },
    false,
  );
}
