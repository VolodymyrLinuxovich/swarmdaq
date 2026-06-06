import { NextResponse } from "next/server";
import { addCustomAgent, getCustomAgents } from "@/lib/memory";
import type { Agent } from "@/lib/types";

const ALLOWED_SKILLS = new Set([
  "research", "fact-checking", "writing", "analysis", "risk-assessment",
  "market-analysis", "pitch-craft", "evaluation", "synthesis", "skepticism",
  "source-verification", "strategic-planning", "data-analysis", "narrative",
  "financial-modeling", "ux-analysis", "technical-review", "competitor-analysis",
]);

const ALLOWED_PROVIDERS = new Set(["gemini", "openai", "anthropic"]);

export async function GET() {
  const agents = await getCustomAgents();
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const body = await req.json() as {
    name?: string;
    role?: string;
    skills?: string[];
    provider?: string;
    reputation?: number;
    price?: number;
  };

  const name = (body.name ?? "").trim().slice(0, 40);
  const role = (body.role ?? "").trim().slice(0, 120);
  const skills = (body.skills ?? []).filter((s) => ALLOWED_SKILLS.has(s)).slice(0, 6);
  const provider = ALLOWED_PROVIDERS.has(body.provider ?? "") ? body.provider as Agent["provider"] : "gemini";
  const reputation = Math.min(82, Math.max(50, Math.round(body.reputation ?? 70)));
  const price = Math.min(0.15, Math.max(0.01, body.price ?? 0.05));

  if (!name || !role || skills.length === 0) {
    return NextResponse.json({ error: "name, role, and at least one skill are required" }, { status: 400 });
  }

  const existing = await getCustomAgents();
  if (existing.length >= 5) {
    return NextResponse.json({ error: "max 5 custom agents — remove one first" }, { status: 400 });
  }

  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const bayesianMean = 0.5;
  const uncertainty = 0.15;

  const agent: Agent = {
    id,
    name: name.endsWith("Agent") ? name : `${name}Agent`,
    role,
    provider,
    skills,
    price,
    reputation,
    factuality: 0.72,
    usefulness: 0.75,
    collaboration: 0.70,
    latencyAvg: 2.0,
    status: "idle",
    alpha: 2,
    beta: 2,
    meanReward: 0.70,
    uncertainty,
    runs: 0,
    wins: 0,
    losses: 0,
    elo: 1200,
    ucbScore: 0.75,
    graphTrust: 0.50,
    bayesianMean,
  };

  await addCustomAgent(agent);
  return NextResponse.json({ agent }, { status: 201 });
}
