import { NextResponse } from "next/server";
import { getAgents, getLeaderboard } from "@/lib/memory";
import type { Agent } from "@/lib/types";

const PROVIDER_KEY_AVAILABLE: Record<string, boolean> = {
  openai: !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
  gemini: !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY),
};

const WORKER_IDS = new Set(["codex", "claude", "gemini"]);

function applyStatusRules(agent: Agent): Agent {
  // Worker agents missing their provider key → offline
  if (WORKER_IDS.has(agent.id) && agent.provider) {
    const keyAvailable = PROVIDER_KEY_AVAILABLE[agent.provider] ?? false;
    if (!keyAvailable && (agent.status === "idle" || agent.status === "ready")) {
      return { ...agent, status: "offline" };
    }
  }
  // Normalize legacy "idle" to "ready"
  if (agent.status === "idle") {
    return { ...agent, status: "ready" };
  }
  return agent;
}

export async function GET() {
  const [agents, leaderboard] = await Promise.all([getAgents(), getLeaderboard()]);
  return NextResponse.json({
    agents: agents.map(applyStatusRules),
    leaderboard: leaderboard.map(applyStatusRules),
  });
}
