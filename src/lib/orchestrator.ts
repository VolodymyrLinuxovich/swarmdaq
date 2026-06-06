import { v4 as uuidv4 } from "uuid";
import {
  Agent,
  AgentBid,
  Task,
  EvalScore,
  MissionResult,
  ReputationChange,
  ImprovementSummary,
  MathSnapshot,
  MarketDecisionEntry,
  DeliberationEntry,
  DeliberationRevision,
  PriceAnomalyInsight,
} from "./types";
import { getExecMode, type ExecMode } from "./mode";
import { computeEvalScore } from "./evaluation";
import {
  getAgents,
  updateAgent,
  recordTaskMemory,
  recordMission,
  getLastMission,
  getTotalAgentRuns,
  getRunCount,
} from "./memory";
import {
  appendMissionEvent,
  appendMarketFeed,
  appendAgentHistory,
  storeMission,
} from "./marketHistory";
import { generateAgentOutput, planMissionTasks, resetTokenAccumulator, getTokenAccumulator, generateDeliberationCritique, generateRevision } from "./gemini";
import { TASKS } from "./agents";
import { getAgentMessages } from "./messages";
import { traceEvent } from "./trace";
import { computeUCB1 } from "./math/bandits";
import {
  updateBayesianReputation,
  updateElo,
  bradleyTerryProbability,
  normalizeElo,
} from "./math/reputation";
import { runAuction } from "./math/auction";
import { computeSwarmPortfolio } from "./math/portfolio";
import {
  computePageRank,
  recordCollaboration,
} from "./math/graphTrust";
import { computeContributionLedger } from "./math/contribution";
import { normalize, clamp01 } from "./math/agentMath";
import type { StreamEvent } from "./types";
import { appendEvaluationEvent, appendMarketEvent } from "./redis/streams";
import {
  computePriceAnomaly,
  priceAnomalyRankingSignal,
  recordBidPrice,
  recordClearingPrice,
  recordEvaluationMarketMetrics,
  storeMarketAnomaly,
} from "./market/price-anomaly";
import { contextualizeMarketAnomaly } from "./market/anomaly-contextualizer";
import { computeMarketMakerScore, type MarketScoreComponents } from "./market/scoring";

// ── Seeded demo arc data (only used in SEEDED_DEMO mode) ─────────────────────
const SEEDED_SCORES: Record<number, EvalScore> = {
  1: { quality: 72, factuality: 68, usefulness: 78, specificity: 70, actionability: 76, collaboration: 74, overall: 74 },
  2: { quality: 92, factuality: 94, usefulness: 90, specificity: 89, actionability: 93, collaboration: 88, overall: 91 },
  3: { quality: 84, factuality: 96, usefulness: 78, specificity: 88, actionability: 72, collaboration: 87, overall: 85 },
  4: { quality: 96, factuality: 95, usefulness: 97, specificity: 94, actionability: 98, collaboration: 95, overall: 96 },
};

const SEEDED_REP_UPDATES: Record<number, Array<{ id: string; delta: number; reason: string; eloDelta: number }>> = {
  1: [
    { id: "research", delta: -4, reason: "Unsupported market-size claim ($4.2B without source)", eloDelta: -18 },
    { id: "source_verifier", delta: 3, reason: "Correctly flagged for future verification pairing", eloDelta: 12 },
    { id: "skeptic", delta: 2, reason: "Thorough risk analysis surfaced critical gaps", eloDelta: 10 },
  ],
  2: [
    { id: "source_verifier", delta: 3, reason: "Drove factuality improvement from 68 → 94", eloDelta: 15 },
    { id: "research", delta: 2, reason: "Performed better with verification support", eloDelta: 8 },
    { id: "skeptic", delta: 2, reason: "Hardened risk section with verified competitive threats", eloDelta: 10 },
    { id: "pitch", delta: 1, reason: "Improved narrative with data-driven proof points", eloDelta: 5 },
  ],
  3: [
    { id: "pitch", delta: -3, reason: "Narrative failure: pitch opened with risk lecture, not story", eloDelta: -14 },
    { id: "skeptic", delta: -1, reason: "Over-inserted risk framing into pitch task", eloDelta: -5 },
    { id: "source_verifier", delta: 1, reason: "Maintained factuality standards through over-rotation", eloDelta: 4 },
  ],
  4: [
    { id: "pitch", delta: 4, reason: "Exceptional narrative recovery — best pitch of the series", eloDelta: 22 },
    { id: "builder", delta: 2, reason: "Narrative-product integration elevated quality", eloDelta: 10 },
    { id: "skeptic", delta: 2, reason: "Calibrated support role: risk woven in gracefully", eloDelta: 10 },
    { id: "source_verifier", delta: 1, reason: "Maintained factuality through the full arc", eloDelta: 4 },
  ],
};

// Task-agent affinity reference — routing uses MarketMaker scores, not this map directly
/* eslint-disable @typescript-eslint/no-unused-vars */
const TASK_AGENT_AFFINITY: Record<string, string[]> = {
  market_research: ["research", "source_verifier"],
  positioning: ["builder", "planner"],
  landing_page_copy: ["pitch", "builder"],
  pitch_script: ["pitch", "skeptic"],
  risk_review: ["skeptic", "source_verifier"],
  final_eval: ["evaluator"],
};
/* eslint-enable @typescript-eslint/no-unused-vars */

function toPriceAnomalyInsight(anomaly: Awaited<ReturnType<typeof computePriceAnomaly>>): PriceAnomalyInsight {
  return {
    label: anomaly.label,
    percentile: anomaly.percentile,
    pValue: anomaly.pValue,
    anomalyScore: anomaly.anomalyScore,
    sampleSize: anomaly.sampleSize,
    historicalMedian: anomaly.historicalMedian,
    historicalP90: anomaly.historicalP90,
    historicalP95: anomaly.historicalP95,
    historicalP99: anomaly.historicalP99,
  };
}

function taskComplexity(task: Task): number {
  return clamp01(task.requiredSkills.length / 4 + task.description.length / 500);
}

async function selectAgentForTask(
  task: Task,
  agents: Agent[],
  totalRuns: number,
  runNum: number,
  mode: ExecMode,
  missionId: string,
  recentEvalScore?: number
): Promise<{ agent: Agent; bids: AgentBid[]; decisionEntry: MarketDecisionEntry }> {
  // Compute UCB scores
  const ucbMap: Record<string, number> = {};
  for (const a of agents) {
    ucbMap[a.id] = computeUCB1(a, totalRuns);
  }

  // PageRank trust
  const trustMap = computePageRank(agents);

  // Run auction for all agents on this task
  const eligibleAgents = agents.filter(
    (a) =>
      !["evaluator", "market_maker", "reputation", "planner"].includes(a.id)
  );
  const bids = runAuction(eligibleAgents, task.id, task.requiredSkills);
  for (const bid of bids) {
    const anomaly = await computePriceAnomaly({ price: bid.cost, taskType: task.type, metric: "bid" });
    bid.priceAnomaly = toPriceAnomalyInsight(anomaly);
    await recordBidPrice(task.type, bid.cost);
    await appendMarketEvent({
      runId: `run-${runNum}`,
      missionId,
      taskId: task.id,
      agentId: bid.agentId,
      eventType: "agent_bid",
      mode,
      payload: {
        taskType: task.type,
        price: bid.cost,
        confidence: bid.confidence,
        expectedQuality: bid.expectedQuality,
        utilityBid: bid.utilityBid,
        priceAnomaly: bid.priceAnomaly,
      },
    });
  }

  // Normalize skill names to underscore format for matching
  const normalizeSkill = (s: string) => s.replace(/-/g, "_");
  const complexity = taskComplexity(task);

  // Score each candidate
  const scored = eligibleAgents.map((agent) => {
    const agentSkills = agent.skills.map(normalizeSkill);
    const skillMatch =
      task.requiredSkills.map(normalizeSkill).filter((s) => agentSkills.includes(s)).length /
      Math.max(task.requiredSkills.length, 1);
    const bid = bids.find((b) => b.agentId === agent.id);
    const ucb = ucbMap[agent.id] ?? 0;
    const trust = clamp01((trustMap[agent.id] ?? 0.1) * 5); // normalize PageRank to 0-1
    const anomaly = bid?.priceAnomaly;
    const priceAnomaly = anomaly
      ? priceAnomalyRankingSignal({ anomaly: { ...anomaly, cdf: null }, agent, taskComplexity: complexity })
      : 0.5;
    const components: MarketScoreComponents = {
      skillMatch,
      bayesianMean: agent.bayesianMean,
      ucbScore: ucb,
      bidUtility: bid?.utilityBid ?? 0,
      elo: normalizeElo(agent.elo),
      graphTrust: trust,
      collaboration: agent.collaboration,
      confidence: bid?.confidence ?? agent.factuality,
      costPenalty: normalize(bid?.cost ?? agent.price, 0, 0.10),
      latencyPenalty: normalize(bid?.latency ?? agent.latencyAvg, 0, 3),
      uncertaintyPenalty: agent.uncertainty,
      priceAnomaly,
    };

    const score = computeMarketMakerScore(components);

    return { agent, score, components };
  });

  // Build decision log for this task (top 3 candidates)
  const topThree = [...scored].sort((a, b) => b.score - a.score).slice(0, 3);
  for (const s of topThree) {
    const bid = bids.find((b) => b.agentId === s.agent.id);
    if (!bid?.priceAnomaly || ["NORMAL_PRICE", "INSUFFICIENT_HISTORY"].includes(bid.priceAnomaly.label)) continue;
    const clearingPrice = bid.clearingPrice ?? bid.cost;
    const explanation = await contextualizeMarketAnomaly({
      taskType: task.type,
      selectedAgent: s.agent,
      bidPrice: bid.cost,
      clearingPrice,
      anomaly: { ...bid.priceAnomaly, cdf: null },
      recentEvalScore,
      taskComplexity: complexity,
    });
    bid.priceAnomaly.explanation = explanation;
    await storeMarketAnomaly({
      ...bid.priceAnomaly,
      timestamp: Date.now(),
      runId: `run-${runNum}`,
      missionId,
      taskType: task.type,
      agentId: s.agent.id,
      agentName: s.agent.name,
      price: bid.cost,
      clearingPrice,
      explanation: explanation.summary,
      cdf: null,
    });
    await appendMarketEvent({
      runId: `run-${runNum}`,
      missionId,
      taskId: task.id,
      agentId: s.agent.id,
      eventType: "anomaly_detected",
      mode,
      payload: {
        taskType: task.type,
        price: bid.cost,
        clearingPrice,
        priceAnomaly: bid.priceAnomaly,
        explanation,
      },
    });
  }

  const topCandidates = topThree.map((s) => {
    const skillMatch = task.requiredSkills.map(normalizeSkill).filter((sk) => s.agent.skills.map(normalizeSkill).includes(sk)).length / Math.max(task.requiredSkills.length, 1);
    const ucb = ucbMap[s.agent.id] ?? 0;
    const trust = clamp01((trustMap[s.agent.id] ?? 0.1) * 5);
    const bid = bids.find((b) => b.agentId === s.agent.id);
    return {
      agentId: s.agent.id,
      agentName: s.agent.name,
      compositeScore: parseFloat(s.score.toFixed(4)),
      finalScore: parseFloat(s.score.toFixed(4)),
      skillMatch: parseFloat(skillMatch.toFixed(3)),
      bayesianMean: parseFloat(s.agent.bayesianMean.toFixed(3)),
      ucb: parseFloat(ucb.toFixed(3)),
      ucbScore: parseFloat(ucb.toFixed(3)),
      elo: parseFloat(normalizeElo(s.agent.elo).toFixed(3)),
      graphTrust: parseFloat(trust.toFixed(3)),
      collaboration: parseFloat(s.agent.collaboration.toFixed(3)),
      confidence: parseFloat((bid?.confidence ?? s.agent.factuality).toFixed(3)),
      costPenalty: parseFloat(normalize(bid?.cost ?? s.agent.price, 0, 0.10).toFixed(3)),
      latencyPenalty: parseFloat(normalize(bid?.latency ?? s.agent.latencyAvg, 0, 3).toFixed(3)),
      uncertaintyPenalty: parseFloat(s.agent.uncertainty.toFixed(3)),
      bidUtility: parseFloat((bid?.utilityBid ?? 0).toFixed(3)),
      priceAnomaly: bid?.priceAnomaly,
      reason: `skill=${(skillMatch * 100).toFixed(0)}% bayes=${(s.agent.bayesianMean * 100).toFixed(0)}% elo=${Math.round(s.agent.elo)} ucb=${ucb.toFixed(3)} price=${bid?.priceAnomaly?.label ?? "UNKNOWN"}`,
    };
  });

  const makeEntry = async (winner: Agent, runnerUp?: Agent): Promise<MarketDecisionEntry> => {
    const winnerBid = bids.find((b) => b.agentId === winner.id);
    const clearingPrice = winnerBid?.clearingPrice ?? bids.find((b) => b.agentId !== winner.id)?.cost ?? winnerBid?.cost ?? winner.price;
    for (const bid of bids) {
      bid.isWinner = bid.agentId === winner.id;
      if (bid.isWinner) bid.clearingPrice = clearingPrice;
    }
    await recordClearingPrice(task.type, clearingPrice);
    await appendMarketEvent({
      runId: `run-${runNum}`,
      missionId,
      taskId: task.id,
      agentId: winner.id,
      eventType: "marketmaker_selection",
      mode,
      payload: {
        taskType: task.type,
        winnerName: winner.name,
        clearingPrice,
        topCandidates,
      },
    });
    return {
      taskType: task.type,
      winnerId: winner.id,
      winnerName: winner.name,
      candidates: topCandidates,
      winReason: runnerUp
        ? `Score advantage: ${(scored.find((s) => s.agent.id === winner.id)?.score ?? 0).toFixed(4)} vs ${(scored.find((s) => s.agent.id === runnerUp.id)?.score ?? 0).toFixed(4)}`
        : "Top-ranked by MarketMaker composite score",
    };
  };

  // ── SEEDED_DEMO scripted routing ──────────────────────────────────────────
  if (mode === "SEEDED_DEMO") {
    // Run 2: pair research with source_verifier (learned from run 1 factuality failure)
    if (runNum === 2 && task.type === "market_research") {
      const researchPair = scored.filter((s) =>
        ["research", "source_verifier"].includes(s.agent.id)
      );
      if (researchPair.length > 0) {
        researchPair.sort((a, b) => b.score - a.score);
        return { agent: researchPair[0].agent, bids, decisionEntry: await makeEntry(researchPair[0].agent) };
      }
    }

    // Run 3: SkepticAgent over-rotated — forces skeptic into pitch_script (the regression)
    if (runNum === 3 && task.type === "pitch_script") {
      const skepticFirst = scored.find((s) => s.agent.id === "skeptic");
      if (skepticFirst) return { agent: skepticFirst.agent, bids, decisionEntry: await makeEntry(skepticFirst.agent) };
    }

    // Run 4: PitchAgent leads pitch, BuilderAgent on copy — balanced recovery
    if (runNum >= 4 && task.type === "pitch_script") {
      const pitchAgent = scored.find((s) => s.agent.id === "pitch");
      if (pitchAgent) return { agent: pitchAgent.agent, bids, decisionEntry: await makeEntry(pitchAgent.agent) };
    }
    if (runNum >= 4 && task.type === "landing_page_copy") {
      const builderAgent = scored.find((s) => s.agent.id === "builder");
      if (builderAgent) return { agent: builderAgent.agent, bids, decisionEntry: await makeEntry(builderAgent.agent) };
    }
  }

  // Newcomer tryout: a custom agent with 0 runs and perfect skill match gets one guaranteed slot
  const newcomer = scored.find(
    (s) =>
      s.agent.id.startsWith("custom_") &&
      s.agent.runs === 0 &&
      task.requiredSkills.map(normalizeSkill).every((sk) =>
        s.agent.skills.map(normalizeSkill).includes(sk)
      )
  );
  if (newcomer) return { agent: newcomer.agent, bids, decisionEntry: await makeEntry(newcomer.agent) };

  scored.sort((a, b) => b.score - a.score);
  return { agent: scored[0].agent, bids, decisionEntry: await makeEntry(scored[0].agent, scored[1]?.agent) };
}

function computeRepUpdates(
  selectedAgents: Agent[],
  taskAssignments: Record<string, Agent>,
  evalScore: EvalScore,
): Array<{ id: string; delta: number; reason: string; eloDelta: number }> {
  const updates: Array<{ id: string; delta: number; reason: string; eloDelta: number }> = [];
  const workerIds = new Set(Object.values(taskAssignments).map((a) => a.id));
  const goodFactuality = evalScore.factuality >= 88;
  const badFactuality = evalScore.factuality < 72;
  const veryHighScore = evalScore.overall >= 92;
  const highScore = evalScore.overall >= 85;
  const lowScore = evalScore.overall < 75;
  const badNarrative = evalScore.actionability < 75 && evalScore.usefulness < 78;
  const goodNarrative = evalScore.actionability >= 85 && evalScore.usefulness >= 88;

  for (const agent of selectedAgents) {
    if (!workerIds.has(agent.id)) continue;
    let delta = 0, reason = "", eloDelta = 0;

    if (agent.id === "research") {
      if (badFactuality) { delta = -4; eloDelta = -18; reason = `Factuality gap (${evalScore.factuality}/100) — unverified claims detected`; }
      else if (goodFactuality && highScore) { delta = 2; eloDelta = 8; reason = `Well-sourced research drove factuality to ${evalScore.factuality}/100`; }
    } else if (agent.id === "source_verifier") {
      if (goodFactuality) { delta = 3; eloDelta = 14; reason = `Source verification drove factuality to ${evalScore.factuality}/100`; }
      else if (evalScore.factuality >= 78) { delta = 1; eloDelta = 4; reason = `Maintained factuality at ${evalScore.factuality}/100`; }
    } else if (agent.id === "skeptic") {
      const pitchTaskAgent = Object.entries(taskAssignments).find(([t]) => t === "pitch_script")?.[1];
      const skepticOwnsNarrative = pitchTaskAgent?.id === "skeptic";
      if (skepticOwnsNarrative && badNarrative) { delta = -2; eloDelta = -10; reason = `Risk framing dominated pitch — actionability dropped to ${evalScore.actionability}/100`; }
      else if (!skepticOwnsNarrative && veryHighScore) { delta = 2; eloDelta = 10; reason = `Risk analysis contributed to peak quality (${evalScore.overall}/100)`; }
      else if (!skepticOwnsNarrative && highScore) { delta = 1; eloDelta = 5; reason = `Risk review maintained quality (${evalScore.overall}/100)`; }
    } else if (agent.id === "pitch") {
      const pitchTaskAgent = Object.entries(taskAssignments).find(([t]) => t === "pitch_script")?.[1];
      if (pitchTaskAgent?.id === "pitch") {
        if (goodNarrative && veryHighScore) { delta = 4; eloDelta = 20; reason = `Exceptional pitch narrative (actionability:${evalScore.actionability} usefulness:${evalScore.usefulness})`; }
        else if (goodNarrative && highScore) { delta = 2; eloDelta = 10; reason = `Strong pitch narrative (actionability:${evalScore.actionability})`; }
        else if (badNarrative) { delta = -3; eloDelta = -14; reason = `Narrative below threshold (actionability:${evalScore.actionability}/100 usefulness:${evalScore.usefulness}/100)`; }
      }
    } else if (agent.id === "builder") {
      if (veryHighScore && evalScore.usefulness >= 90) { delta = 2; eloDelta = 10; reason = `Product depth elevated usefulness to ${evalScore.usefulness}/100`; }
      else if (highScore) { delta = 1; eloDelta = 4; reason = `Contributed to high quality output (${evalScore.overall}/100)`; }
      else if (lowScore) { delta = -1; eloDelta = -5; reason = `Output below quality threshold (${evalScore.overall}/100)`; }
    }

    // Generic fallback for agents not specifically covered
    if (delta === 0 && !["evaluator", "market_maker", "planner", "reputation"].includes(agent.id)) {
      if (highScore) { delta = 1; eloDelta = 4; reason = `Contributed to successful mission (${evalScore.overall}/100)`; }
      else if (lowScore) { delta = -1; eloDelta = -4; reason = `Mission below quality threshold (${evalScore.overall}/100)`; }
    }

    if (delta !== 0) updates.push({ id: agent.id, delta, reason, eloDelta });
  }
  return updates;
}

async function planTasksForMission(mission: string): Promise<Task[]> {
  const plan = await planMissionTasks(mission);
  if (!plan) {
    return TASKS.map((t) => ({ ...t }));
  }
  return plan.map((p) => ({
    id: p.type,
    type: p.type,
    description: p.description,
    requiredSkills: p.requiredSkills,
    status: "pending" as const,
  }));
}

// ── Hardcoded deliberation fallbacks for the 4-run arc ───────────────────────

const DELIBERATION_FALLBACKS: Record<number, {
  entries: Array<Omit<DeliberationEntry, "criticId" | "targetAgentId">>;
  revisions: Array<Omit<DeliberationRevision, "agentId"> & { agentName: string }>;
}> = {
  1: {
    entries: [
      { kind: "objection", criticName: "SkepticAgent", targetAgentName: "ResearchAgent", taskType: "market_research", claim: "The $4.2B market-size figure has no cited source — any investor will challenge this immediately.", severity: "critical" },
      { kind: "objection", criticName: "SkepticAgent", targetAgentName: "ResearchAgent", taskType: "market_research", claim: "The 73% stat is suspiciously round. Unattributed data damages credibility more than no data.", severity: "minor" },
      { kind: "endorsement", criticName: "SkepticAgent", targetAgentName: "PitchAgent", taskType: "pitch_script", claim: "The '4am hands-up' opener is sharp — immediately relatable, emotionally specific." },
      { kind: "objection", criticName: "SourceVerifierAgent", targetAgentName: "ResearchAgent", taskType: "market_research", claim: "Cannot verify $4.2B against HolonIQ, Gartner, or IDC current data. Figure appears fabricated.", severity: "critical" },
      { kind: "endorsement", criticName: "SourceVerifierAgent", targetAgentName: "SkepticAgent", taskType: "risk_analysis", claim: "Commoditization risk is correctly framed as existential and urgent — well done." },
    ],
    revisions: [
      { agentName: "ResearchAgent", taskType: "market_research", summary: "Added '(source: verification required)' caveat to the $4.2B figure and downgraded claim confidence to low." },
    ],
  },
  2: {
    entries: [
      { kind: "endorsement", criticName: "SkepticAgent", targetAgentName: "ResearchAgent", taskType: "market_research", claim: "All figures now cite sources — HolonIQ and MLH data are verifiable. Significant improvement." },
      { kind: "endorsement", criticName: "SkepticAgent", targetAgentName: "PitchAgent", taskType: "pitch_script", claim: "Story-driven structure with verified proof points is exactly the right fix from run 1." },
      { kind: "endorsement", criticName: "SourceVerifierAgent", targetAgentName: "ResearchAgent", taskType: "market_research", claim: "MLH 2024 survey data (n=12,400) is real and verifiable. High confidence. Great sourcing." },
      { kind: "endorsement", criticName: "SourceVerifierAgent", targetAgentName: "SkepticAgent", taskType: "risk_analysis", claim: "Every risk now has a named mitigation with a timeline. This is what investors want to see." },
    ],
    revisions: [],
  },
  3: {
    entries: [
      { kind: "objection", criticName: "SkepticAgent", targetAgentName: "PitchAgent", taskType: "pitch_script", claim: "This pitch opens with risk framing, not a story. Judges tune out after 10 seconds of caveats.", severity: "critical" },
      { kind: "objection", criticName: "SkepticAgent", targetAgentName: "BuilderAgent", taskType: "landing_page_copy", claim: "Headline 'An AI Tool That Helps You Organize Research' is passive and forgettable.", severity: "minor" },
      { kind: "endorsement", criticName: "SkepticAgent", targetAgentName: "SourceVerifierAgent", taskType: "market_research", claim: "Factuality held at 96 — every claim is watertight despite over-rotation elsewhere." },
      { kind: "objection", criticName: "SourceVerifierAgent", targetAgentName: "PitchAgent", taskType: "pitch_script", claim: "Opening line 'May improve pitch preparation' undercuts the confidence established in run 2.", severity: "critical" },
    ],
    revisions: [
      { agentName: "PitchAgent", taskType: "pitch_script", summary: "Revised opening to lead with risk acknowledgment — partially addressed SkepticAgent objection but over-corrected, creating hedged narrative." },
    ],
  },
  4: {
    entries: [
      { kind: "endorsement", criticName: "SkepticAgent", targetAgentName: "PitchAgent", taskType: "pitch_script", claim: "'The team that wins HackMIT isn't always the best engineers' — this is the sharpest line in the entire 4-run arc." },
      { kind: "endorsement", criticName: "SkepticAgent", targetAgentName: "BuilderAgent", taskType: "landing_page_copy", claim: "The 'Isn't this just ChatGPT?' reframe is a masterclass in objection handling within copy." },
      { kind: "objection", criticName: "SkepticAgent", targetAgentName: "PitchAgent", taskType: "pitch_script", claim: "The ask ($400K) should name the judge feedback flywheel specifically — it's the defensible moat.", severity: "minor" },
      { kind: "endorsement", criticName: "SourceVerifierAgent", targetAgentName: "ResearchAgent", taskType: "market_research", claim: "2.8x win rate across 240 teams, 18 hackathons — this is verifiable and powerful social proof." },
    ],
    revisions: [
      { agentName: "PitchAgent", taskType: "pitch_script", summary: "Strengthened the ask line: 'We're raising $400K to build the judge feedback flywheel — the only compounding moat in this market.'" },
    ],
  },
};

async function runDeliberation(params: {
  outputs: Record<string, string>;
  taskAssignments: Record<string, Agent>;
  selectedAgents: Agent[];
  mission: string;
  runNum: number;
  mode: ExecMode;
  emit: (e: StreamEvent) => void;
}): Promise<{ revisedOutputs: Record<string, string>; allEntries: DeliberationEntry[]; allRevisions: DeliberationRevision[] }> {
  const { outputs, taskAssignments, selectedAgents, mission, runNum, mode, emit } = params;
  const revisedOutputs = { ...outputs };
  const allEntries: DeliberationEntry[] = [];
  const allRevisions: DeliberationRevision[] = [];

  emit({ type: "deliberation_start" });

  const critics = selectedAgents.filter((a) => ["skeptic", "source_verifier"].includes(a.id));
  const isDefaultMission = mission.toLowerCase().includes("hackathon") || mission.toLowerCase().includes("student");

  // Use seeded fallbacks only in SEEDED_DEMO mode
  const useSeededDeliberation = mode === "SEEDED_DEMO" && isDefaultMission && !!DELIBERATION_FALLBACKS[runNum];
  if (useSeededDeliberation) {
    const fallback = DELIBERATION_FALLBACKS[runNum];

    // Stream entries with a short delay between each for visual effect
    for (const raw of fallback.entries) {
      const criticAgent = selectedAgents.find((a) => a.name === raw.criticName) ?? critics[0];
      const targetAgent = selectedAgents.find((a) => a.name === raw.targetAgentName)
        ?? Object.values(taskAssignments).find((a) => a.name === raw.targetAgentName);
      if (!criticAgent || !targetAgent) continue;

      const entry: DeliberationEntry = {
        ...raw,
        criticId: criticAgent.id,
        targetAgentId: targetAgent.id,
      };
      allEntries.push(entry);
      emit({ type: "deliberation_entry", entry });
      await new Promise((r) => setTimeout(r, 220));
    }

    for (const raw of fallback.revisions) {
      const agent = selectedAgents.find((a) => a.name === raw.agentName)
        ?? Object.values(taskAssignments).find((a) => a.name === raw.agentName);
      if (!agent) continue;
      const revision: DeliberationRevision = { agentId: agent.id, agentName: agent.name, taskType: raw.taskType, summary: raw.summary };
      allRevisions.push(revision);
      emit({ type: "deliberation_revision", revision });
      await new Promise((r) => setTimeout(r, 180));
    }
  } else {
    // Real LLM deliberation for custom missions
    for (const critic of critics) {
      const otherOutputs = Object.entries(outputs)
        .filter(() => true)
        .map(([taskType, output]) => ({
          agentName: taskAssignments[taskType]?.name ?? "Unknown",
          taskType,
          output,
        }))
        .filter((o) => o.agentName !== critic.name);

      if (otherOutputs.length === 0) continue;

      const result = await generateDeliberationCritique({
        criticName: critic.name,
        criticRole: critic.role,
        mission,
        otherOutputs,
      });

      if (!result) continue;

      for (const obj of result.objections) {
        const targetAgent = Object.values(taskAssignments).find((a) => a.name === obj.targetAgent);
        if (!targetAgent) continue;
        const entry: DeliberationEntry = {
          kind: "objection",
          criticId: critic.id,
          criticName: critic.name,
          targetAgentId: targetAgent.id,
          targetAgentName: targetAgent.name,
          taskType: obj.taskType,
          claim: obj.claim,
          severity: obj.severity,
        };
        allEntries.push(entry);
        emit({ type: "deliberation_entry", entry });

        // Revise if critical
        if (obj.severity === "critical" && outputs[obj.taskType]) {
          const revised = await generateRevision({
            agentName: targetAgent.name,
            agentRole: targetAgent.role,
            mission,
            taskType: obj.taskType,
            originalOutput: outputs[obj.taskType],
            objectionClaim: obj.claim,
          });
          if (revised) {
            revisedOutputs[obj.taskType] = revised;
            const revision: DeliberationRevision = {
              agentId: targetAgent.id,
              agentName: targetAgent.name,
              taskType: obj.taskType,
              summary: `Addressed: "${obj.claim.slice(0, 80)}"`,
            };
            allRevisions.push(revision);
            emit({ type: "deliberation_revision", revision });
          }
        }
      }

      for (const end of result.endorsements) {
        const targetAgent = Object.values(taskAssignments).find((a) => a.name === end.targetAgent);
        if (!targetAgent) continue;
        const entry: DeliberationEntry = {
          kind: "endorsement",
          criticId: critic.id,
          criticName: critic.name,
          targetAgentId: targetAgent.id,
          targetAgentName: targetAgent.name,
          taskType: end.taskType,
          claim: end.claim,
        };
        allEntries.push(entry);
        emit({ type: "deliberation_entry", entry });
      }
    }
  }

  emit({
    type: "deliberation_done",
    objections: allEntries.filter((e) => e.kind === "objection").length,
    endorsements: allEntries.filter((e) => e.kind === "endorsement").length,
    revisions: allRevisions.length,
  });

  return { revisedOutputs, allEntries, allRevisions };
}

export async function runMission(mission: string, clientRunNumber?: number, onEvent?: (e: StreamEvent) => void): Promise<MissionResult> {
  const emit = (e: StreamEvent) => { try { onEvent?.(e); } catch {} };
  const mode = getExecMode();
  resetTokenAccumulator();
  const missionId = uuidv4();
  const agents = await getAgents();
  const totalRuns = await getTotalAgentRuns();
  const runNum = clientRunNumber ?? (await getRunCount()) + 1;
  const lastMission = await getLastMission();
  const runId = `run-${runNum}`;

  await traceEvent({ type: "mission_received", data: { missionId, mission, runNum } });
  await appendMarketEvent({
    runId,
    missionId,
    eventType: "mission_created",
    mode,
    payload: { mission, runNumber: runNum },
  });
  await appendMissionEvent({ eventType: "mission_received", missionId, runNumber: runNum, timestamp: Date.now(), message: `Mission received: "${mission.slice(0, 80)}"` });
  await appendMarketFeed({ timestamp: Date.now(), eventType: "mission_started", text: `Run #${runNum} started: "${mission.slice(0, 60)}"`, color: "#00aaff" });
  emit({ type: "phase", phase: "planning" });

  // Mark planner as running
  await updateAgent("planner", { status: "running" });
  await traceEvent({ type: "plan_mission", data: { missionId } });

  const tasks = await planTasksForMission(mission);
  emit({ type: "tasks", tasks });
  for (const task of tasks) {
    await appendMarketEvent({
      runId,
      missionId,
      taskId: task.id,
      eventType: "task_created",
      mode,
      payload: {
        taskType: task.type,
        description: task.description,
        requiredSkills: task.requiredSkills,
      },
    });
  }

  await updateAgent("planner", { status: "done" });

  // Auction phase
  const allBids: AgentBid[] = [];
  const selectedAgentIds: Set<string> = new Set();
  const selectedAgents: Agent[] = [];
  const taskAssignments: Record<string, Agent> = {};
  const marketDecisionLog: MarketDecisionEntry[] = [];

  for (const task of tasks) {
    if (task.type === "final_eval") continue;

    await traceEvent({ type: "collect_bid", data: { taskId: task.id } });
    const { agent, bids, decisionEntry } = await selectAgentForTask(
      task,
      agents,
      totalRuns,
      runNum,
      mode,
      missionId,
      lastMission?.evalScore.overall
    );

    allBids.push(...bids.slice(0, 3)); // top 3 bids per task
    marketDecisionLog.push(decisionEntry);
    task.assignedAgentId = agent.id;
    task.status = "assigned";
    taskAssignments[task.id] = agent;

    if (!selectedAgentIds.has(agent.id)) {
      selectedAgentIds.add(agent.id);
      selectedAgents.push(agent);
    }

    await updateAgent(agent.id, { status: "selected" });
    emit({ type: "bid", taskType: task.type, winnerName: agent.name, bids: bids.slice(0, 3), decisionEntry });
  }

  // Always include evaluator
  const evaluator = agents.find((a) => a.id === "evaluator")!;
  if (!selectedAgentIds.has("evaluator")) {
    selectedAgents.push(evaluator);
    selectedAgentIds.add("evaluator");
  }

  await traceEvent({
    type: "select_swarm",
    data: { selectedAgents: selectedAgents.map((a) => a.name) },
  });
  await appendMissionEvent({ eventType: "swarm_selected", missionId, runNumber: runNum, timestamp: Date.now(), message: `Swarm selected: ${selectedAgents.map((a) => a.name).join(", ")}` });
  emit({ type: "swarm", agents: selectedAgents });
  emit({ type: "phase", phase: "executing" });

  // Execution phase
  const outputs: Record<string, string> = {};
  // LIVE mode: don't leak run number to LLM
  // SEEDED_DEMO/FALLBACK: use run-based variant for fallback output selection
  const contextStr = mode === "LIVE" ? "" : `run${runNum >= 4 ? 4 : runNum}`;

  for (const task of tasks) {
    if (task.type === "final_eval") continue;
    const agent = taskAssignments[task.id];
    if (!agent) continue;

    await updateAgent(agent.id, { status: "running" });
    await traceEvent({ type: "run_agent", data: { agentId: agent.id, task: task.type } });
    await appendMissionEvent({ eventType: "agent_started", missionId, runNumber: runNum, timestamp: Date.now(), agentId: agent.id, agentName: agent.name, message: `${agent.name} started task: ${task.type}` });
    emit({ type: "agent_start", agentId: agent.id, agentName: agent.name, taskType: task.type });

    const output = await generateAgentOutput({
      agentName: agent.name,
      role: agent.role,
      task: task.description,
      mission,
      context: contextStr,
    });

    outputs[task.type] = output;
    task.output = output;
    task.status = "done";
    await updateAgent(agent.id, { status: "done" });
    await appendMissionEvent({ eventType: "agent_completed", missionId, runNumber: runNum, timestamp: Date.now(), agentId: agent.id, agentName: agent.name, message: `${agent.name} completed task: ${task.type}` });
    await appendMarketEvent({
      runId,
      missionId,
      taskId: task.id,
      agentId: agent.id,
      eventType: "task_completed",
      mode,
      payload: {
        taskType: task.type,
        outputPreview: output.slice(0, 280),
      },
    });
    emit({ type: "agent_done", agentId: agent.id, agentName: agent.name, taskType: task.type, output });
  }

  // Deliberation — critics review outputs, flag issues, agents revise
  emit({ type: "phase", phase: "deliberating" });
  const { revisedOutputs, allEntries: deliberationEntries, allRevisions } = await runDeliberation({
    outputs,
    taskAssignments,
    selectedAgents,
    mission,
    runNum,
    mode,
    emit,
  });
  // Apply revisions back to tasks
  for (const task of tasks) {
    if (revisedOutputs[task.type] && revisedOutputs[task.type] !== outputs[task.type]) {
      task.output = revisedOutputs[task.type];
    }
  }

  // Evaluation
  await updateAgent("evaluator", { status: "running" });
  await traceEvent({ type: "evaluate_output", data: { runNum } });

  const evalOutput = await generateAgentOutput({
    agentName: "EvaluatorAgent",
    role: "Scores agent outputs",
    task: "final_eval",
    mission,
    context: contextStr,
  });
  outputs["final_eval"] = evalOutput;

  // Eval score — seeded in demo mode, real computation otherwise
  let evalScore: EvalScore;
  if (mode === "SEEDED_DEMO") {
    evalScore = SEEDED_SCORES[runNum] ?? SEEDED_SCORES[4];
  } else {
    evalScore = await computeEvalScore(mission, outputs, selectedAgents, evalOutput);
  }

  await updateAgent("evaluator", { status: "done" });
  await appendEvaluationEvent({
    runId,
    missionId,
    agentId: "evaluator",
    eventType: "evaluation_completed",
    mode,
    payload: { evalScore },
  });
  await appendMarketEvent({
    runId,
    missionId,
    agentId: "evaluator",
    eventType: "evaluation_completed",
    mode,
    payload: { evalScore },
  });
  emit({ type: "phase", phase: "evaluating" });
  emit({ type: "score", evalScore });

  // Reputation updates
  await traceEvent({ type: "update_reputation", data: { runNum } });
  emit({ type: "phase", phase: "updating" });

  const reputationChanges: ReputationChange[] = [];

  const repUpdates: Array<{ id: string; delta: number; reason: string; eloDelta?: number }> =
    mode === "SEEDED_DEMO"
      ? (SEEDED_REP_UPDATES[runNum] ?? SEEDED_REP_UPDATES[4])
      : computeRepUpdates(selectedAgents, taskAssignments, evalScore);

  for (const upd of repUpdates) {
    const agent = agents.find((a) => a.id === upd.id);
    if (!agent) continue;

    const newRep = Math.max(0, Math.min(100, agent.reputation + upd.delta));
    const evalNormalized =
      evalScore.overall / 100 +
      (upd.delta > 0 ? 0.1 : -0.1) * Math.abs(upd.delta);
    const bayesian = updateBayesianReputation(agent, clamp01(evalNormalized));
    const eloResult = updateElo(
      agent.elo,
      1450,
      upd.delta > 0 ? 1 : upd.delta === 0 ? 0.5 : 0
    );

    await updateAgent(upd.id, {
      reputation: newRep,
      alpha: bayesian.alpha,
      beta: bayesian.beta,
      bayesianMean: bayesian.bayesianMean,
      uncertainty: bayesian.uncertainty,
      elo: eloResult.newRatingA,
      runs: agent.runs + 1,
      wins: upd.delta > 0 ? agent.wins + 1 : agent.wins,
      losses: upd.delta < 0 ? agent.losses + 1 : agent.losses,
      meanReward: (agent.meanReward * agent.runs + evalScore.overall / 100) / (agent.runs + 1),
      status: upd.delta > 0 ? "promoted" : upd.delta < 0 ? "penalized" : "done",
    });

    const repChange = {
      agentId: upd.id,
      agentName: agent.name,
      delta: upd.delta,
      reason: upd.reason,
      eloDelta: eloResult.deltaA,
      alphaDelta: bayesian.alpha - agent.alpha,
      betaDelta: bayesian.beta - agent.beta,
    };
    reputationChanges.push(repChange);
    emit({ type: "rep_change", change: repChange });

    // Market feed + agent history
    const labelColors: Record<string, string> = { promoted: "#00ff88", penalized: "#ef4444", done: "#fbbf24" };
    const feedEventType = upd.delta > 0 ? "agent_promoted" as const : upd.delta < 0 ? "agent_penalized" as const : "reputation_update" as const;
    await appendMarketFeed({
      timestamp: Date.now(),
      agentId: upd.id,
      agentName: agent.name,
      eventType: feedEventType,
      text: `${agent.name} ${upd.delta > 0 ? "▲" : upd.delta < 0 ? "▼" : "─"} ${upd.delta > 0 ? "+" : ""}${upd.delta} rep | ${upd.reason.slice(0, 60)}`,
      delta: upd.delta,
      color: upd.delta > 0 ? labelColors.promoted : upd.delta < 0 ? labelColors.penalized : labelColors.done,
    });
    await appendAgentHistory(upd.id, {
      missionId,
      runNumber: runNum,
      score: evalScore.overall,
      delta: upd.delta,
      timestamp: Date.now(),
      role: agent.role,
    });
    await appendMissionEvent({ eventType: "reputation_updated", missionId, runNumber: runNum, timestamp: Date.now(), agentId: upd.id, agentName: agent.name, delta: upd.delta, score: evalScore.overall, message: `Rep ${upd.delta > 0 ? "+" : ""}${upd.delta}: ${upd.reason}` });
    await appendMarketEvent({
      runId,
      missionId,
      agentId: upd.id,
      eventType: "reputation_updated",
      mode,
      payload: {
        agentName: agent.name,
        delta: upd.delta,
        reason: upd.reason,
        eloDelta: eloResult.deltaA,
        newReputation: newRep,
        bayesianMean: bayesian.bayesianMean,
      },
    });
  }

  // Update stats for all selected agents not already covered by repUpdates
  const updatedIds = new Set(repUpdates.map((u) => u.id));
  for (const agent of selectedAgents) {
    if (updatedIds.has(agent.id)) continue;
    const evalNorm = clamp01(evalScore.overall / 100);
    const bayesian = updateBayesianReputation(agent, evalNorm);
    await updateAgent(agent.id, {
      alpha: bayesian.alpha,
      beta: bayesian.beta,
      bayesianMean: bayesian.bayesianMean,
      uncertainty: bayesian.uncertainty,
      runs: agent.runs + 1,
      meanReward: (agent.meanReward * agent.runs + evalNorm) / (agent.runs + 1),
      status: "done",
    });
    await appendAgentHistory(agent.id, {
      missionId,
      runNumber: runNum,
      score: evalScore.overall,
      delta: 0,
      timestamp: Date.now(),
      role: agent.role,
    });
  }

  // Record collaboration for all agent pairs that co-ran this mission
  const workerEntries = Object.entries(taskAssignments);
  for (let i = 0; i < workerEntries.length; i++) {
    for (let j = i + 1; j < workerEntries.length; j++) {
      const [, agentA] = workerEntries[i];
      const [, agentB] = workerEntries[j];
      if (agentA.id !== agentB.id) {
        const synergyScore = (evalScore.collaboration / 100) * 0.12;
        recordCollaboration(agentA.id, agentB.id, synergyScore);
      }
    }
  }

  // Task memory
  for (const task of tasks) {
    if (task.assignedAgentId) {
      await recordTaskMemory(task.type, task.assignedAgentId, evalScore.overall / 100);
    }
  }

  // Compute math snapshot
  const freshAgents = await getAgents();
  const totalRunsNow = freshAgents.reduce((s, a) => s + a.runs, 0);
  const ucbScores: Record<string, number> = {};
  const bayesianMeans: Record<string, number> = {};
  const uncertainties: Record<string, number> = {};
  const eloRatings: Record<string, number> = {};
  for (const a of freshAgents) {
    ucbScores[a.id] = computeUCB1(a, totalRunsNow);
    bayesianMeans[a.id] = a.bayesianMean;
    uncertainties[a.id] = a.uncertainty;
    eloRatings[a.id] = a.elo;
  }

  const trustMap = computePageRank(freshAgents);
  const graphTrust: Record<string, number> = {};
  for (const [id, val] of Object.entries(trustMap)) {
    graphTrust[id] = clamp01(val * 5);
  }

  const pairwiseProbabilities = [
    {
      a: "source_verifier",
      b: "research",
      pABeatsB: bradleyTerryProbability(
        freshAgents.find((a) => a.id === "source_verifier")?.elo ?? 1510,
        freshAgents.find((a) => a.id === "research")?.elo ?? 1420
      ),
      dimension: "factuality",
    },
    {
      a: "skeptic",
      b: "builder",
      pABeatsB: bradleyTerryProbability(
        freshAgents.find((a) => a.id === "skeptic")?.elo ?? 1540,
        freshAgents.find((a) => a.id === "builder")?.elo ?? 1450
      ),
      dimension: "risk analysis",
    },
    {
      a: "pitch",
      b: "research",
      pABeatsB: bradleyTerryProbability(
        freshAgents.find((a) => a.id === "pitch")?.elo ?? 1460,
        freshAgents.find((a) => a.id === "research")?.elo ?? 1420
      ),
      dimension: "narrative",
    },
  ];

  const swarmPortfolio = computeSwarmPortfolio(selectedAgents);

  const mathSnapshot: MathSnapshot = {
    ucbScores,
    bayesianMeans,
    uncertainties,
    eloRatings,
    graphTrust,
    swarmPortfolio,
    pairwiseProbabilities,
  };

  // Shapley contributions
  const shapleyContributions = computeContributionLedger(
    selectedAgents,
    evalScore.overall
  );

  // Improvement summary
  let improvementFromPrevious: ImprovementSummary | undefined;
  if (lastMission) {
    const prevScore = lastMission.evalScore.overall;
    const currScore = evalScore.overall;
    const prevPortfolio = lastMission.swarmPortfolio;
    const factDelta = evalScore.factuality - lastMission.evalScore.factuality;
    const objDelta = swarmPortfolio.objective - prevPortfolio.objective;
    const scoreDelta = currScore - prevScore;

    const pitchAgent = Object.entries(taskAssignments).find(([t]) => t === "pitch_script")?.[1];
    const narrativeAgent = pitchAgent?.name ?? "agent";

    const defaultMsg = scoreDelta < 0
      ? `Score dropped ${Math.abs(scoreDelta)} pts (${prevScore} → ${currScore}). Factuality: ${evalScore.factuality}/100. ${narrativeAgent} led pitch.`
      : `Score improved ${scoreDelta} pts (${prevScore} → ${currScore}). Factuality +${factDelta}. Swarm objective ${prevPortfolio.objective.toFixed(2)} → ${swarmPortfolio.objective.toFixed(2)}.`;

    let message: string;
    if (mode === "SEEDED_DEMO") {
      const messageByRun: Record<number, string> = {
        2: `Market learned: factuality +${factDelta}, confidence +12%, risk −23%, cost +$0.03. Swarm objective ${prevPortfolio.objective.toFixed(2)} → ${swarmPortfolio.objective.toFixed(2)}.`,
        3: `Market over-rotated: SkepticAgent displaced PitchAgent. Narrative quality −13%, factuality +${factDelta}. Score ${prevScore} → ${currScore}. Regression visible — rebalancing required.`,
        4: `Market calibrated: PitchAgent + BuilderAgent synergy unlocked. Score ${prevScore} → ${currScore}. New peak across all dimensions. Swarm objective ${prevPortfolio.objective.toFixed(2)} → ${swarmPortfolio.objective.toFixed(2)}.`,
      };
      message = messageByRun[runNum] ?? defaultMsg;
    } else {
      message = defaultMsg;
    }

    improvementFromPrevious = {
      factualityDelta: factDelta,
      confidenceDelta: scoreDelta > 0 ? Math.round(scoreDelta * 0.6) : Math.round(scoreDelta * 0.6),
      riskDelta: evalScore.actionability >= 85 ? -15 : evalScore.actionability < 70 ? 12 : 0,
      costDelta: 0.03,
      swarmObjectiveDelta: objDelta,
      previousScore: prevScore,
      currentScore: currScore,
      message,
    };
  }

  // Final synthesis
  await traceEvent({ type: "final_synthesis", data: { missionId, score: evalScore.overall } });

  // Cost computation — Gemini 2.5 Flash pricing (non-thinking tier)
  const tokens = getTokenAccumulator();
  const GEMINI_INPUT_RATE  = 0.075 / 1_000_000; // $ per token
  const GEMINI_OUTPUT_RATE = 0.30  / 1_000_000;
  const totalUSD = tokens.input * GEMINI_INPUT_RATE + tokens.output * GEMINI_OUTPUT_RATE;
  const runCost = { inputTokens: tokens.input, outputTokens: tokens.output, totalUSD, model: "gemini-2.5-flash" };
  await recordEvaluationMarketMetrics({
    latencyMs: Math.round(selectedAgents.reduce((sum, agent) => sum + agent.latencyAvg, 0) / Math.max(selectedAgents.length, 1) * 1000),
    scoreDelta: evalScore.overall - (lastMission?.evalScore.overall ?? evalScore.overall),
    costPerQualityPoint: evalScore.overall > 0 ? totalUSD / evalScore.overall : totalUSD,
  });

  const entity  = process.env.WANDB_ENTITY  ?? "vborysenko-uc-berkeley";
  const project = process.env.WANDB_PROJECT ?? "swarmdaq";
  const weaveTraceUrl = `https://wandb.ai/${entity}/${project}/weave`;

  // Build final output
  const result: MissionResult = {
    missionId,
    mission,
    tasks,
    selectedAgents,
    bids: allBids,
    output: {
      positioning: outputs["positioning"] ?? "Positioning complete.",
      landingHeadline: outputs["landing_page_copy"] ?? "Landing page copy complete.",
      risks: outputs["risk_review"]
        ? outputs["risk_review"].split("\n").filter((l) => l.startsWith("**Risk")).slice(0, 5)
        : ["Market risk", "Competitive risk", "Technical risk"],
      pitch: outputs["pitch_script"] ?? "Pitch script complete.",
      swarmComposition: selectedAgents.map((a) => a.name),
    },
    evalScore,
    reputationChanges,
    traces: [],
    swarmPortfolio,
    shapleyContributions,
    mathSnapshot,
    runNumber: runNum,
    improvementFromPrevious,
    agentMessages: getAgentMessages(runNum),
    runCost,
    weaveTraceUrl,
    marketDecisionLog,
    deliberationLog: { entries: deliberationEntries, revisions: allRevisions },
  };

  await recordMission(result);
  await storeMission(result);
  emit({ type: "done", result });
  await appendMissionEvent({ eventType: "mission_completed", missionId, runNumber: runNum, timestamp: Date.now(), score: evalScore.overall, message: `Mission complete — score ${evalScore.overall}/100` });
  await appendMarketFeed({ timestamp: Date.now(), eventType: "mission_complete", text: `Run #${runNum} complete — score ${evalScore.overall}/100. Swarm: ${selectedAgents.map((a) => a.name).join(", ")}`, color: evalScore.overall >= 90 ? "#00ff88" : evalScore.overall >= 80 ? "#fbbf24" : "#ef4444" });
  await appendMarketEvent({
    runId,
    missionId,
    eventType: "run_completed",
    mode,
    payload: {
      runNumber: runNum,
      score: evalScore.overall,
      selectedAgents: selectedAgents.map((a) => a.id),
      totalUSD,
      marketDecisionLog,
    },
  });

  return result;
}
