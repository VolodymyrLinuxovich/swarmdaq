// Client helpers
export {
  redis,
  getRedisClient,
  isRedisEnabled,
  isRedisAvailable,
  safeRedis,
  rawRedisCommand,
  closeRedisClient,
  getRedisRuntimeStatus,
} from "./client";

// KEY schema
export { KEY } from "./keys";
export type { RedisKey } from "./keys";

// Stream helpers
export {
  appendMarketEvent,
  appendEvaluationEvent,
  getStreamLength,
  getRecentMarketEvents,
  clearInMemoryStreams,
  buildMarketEventStreamFields,
} from "./streams";
export type { MarketEventType, RedisMarketEvent } from "./streams";

// Agent-memory helpers (hashes, leaderboards)
export {
  agentFromHash,
  agentReputationSnapshot,
  computeAgentMarketValue,
  updateAgentLeaderboards,
  writeAgentState,
  readAgentState,
  deleteAgentState,
} from "./reputation";

// T-digest helpers
export {
  addTDigestValue,
  addTDigestValues,
  getTDigestCDF,
  getTDigestInfo,
  getTDigestQuantiles,
  getTDigestRank,
  getTDigestRuntimeStatus,
  getTDigestFallbackMode,
  isTDigestSupported,
  resetLocalTDigestFallback,
  ensureTDigest,
  recordBidPrice,
  recordClearingPrice,
  recordLatency,
  recordScoreDelta,
  recordCostQuality,
  getQuantiles,
  estimateCDF,
  getDigestInfo,
} from "./tdigest";
export type { TDigestFallbackMode } from "./tdigest";
