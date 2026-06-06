import { Redis } from "@upstash/redis";

export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export function isRedisAvailable(): boolean {
  return redis !== null;
}

// ── Key schema ────────────────────────────────────────────────────────────────
export const KEY = {
  runCount:         "swarmdaq:runCount",
  lastMission:      "swarmdaq:lastMission",
  agent:            (id: string) => `swarmdaq:agent:${id}`,
  agentHistory:     (id: string) => `swarmdaq:agent:${id}:history`,
  taskMem:          (type: string, id: string) => `swarmdaq:mem:${type}:${id}`,
  lbReputation:     "swarmdaq:lb:reputation",
  lbBayesian:       "swarmdaq:lb:bayesian",
  lbElo:            "swarmdaq:lb:elo",
  lbUncertainty:    "swarmdaq:lb:uncertainty",     // lower is better → store 1-val
  missionsIndex:    "swarmdaq:missions:index",      // sorted set, score = timestamp
  mission:          (id: string) => `swarmdaq:mission:${id}`,
  missionEvents:    (id: string) => `swarmdaq:events:${id}`,
  marketFeed:       "swarmdaq:market:feed",
  customAgentsList: "swarmdaq:custom_agents",

  // ── T-Digest sketches (Redis Stack / RedisBloom required) ─────────────────
  tdScoreOverall:    "swarmdaq:td:score:overall",
  tdScoreDimension:  (dim: string) => `swarmdaq:td:score:${dim}`,
  tdAgentScore:      (agentId: string) => `swarmdaq:td:agent:${agentId}:score`,
  tdAgentDelta:      (agentId: string) => `swarmdaq:td:agent:${agentId}:delta`,
  tdLatencyGlobal:   "swarmdaq:td:latency:global",
  tdLatencyModel:    (model: string) => `swarmdaq:td:latency:model:${model}`,
} as const;

export type RedisKey = (typeof KEY)[keyof typeof KEY];
