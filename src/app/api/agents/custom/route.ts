import { NextResponse } from "next/server";
import { addCustomAgent, getCustomAgents } from "@/lib/memory";
import type { Agent } from "@/lib/types";

const ALLOWED_SKILLS = new Set([
  "research", "market_analysis", "competitive_intel", "data_synthesis",
  "fact_checking", "source_validation", "skepticism", "risk_assessment",
  "pitch", "narrative", "copywriting", "storytelling",
  "product_design", "ux_analysis", "positioning", "go_to_market",
  "evaluation", "scoring", "analysis", "strategy",
  "planning", "coordination", "financial_modeling", "technical_review",
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

  // Derive priors from the requested reputation so the agent is competitive from the start
  const repNorm = reputation / 100;          // 0.50–0.82
  const bayesianMean = repNorm;
  const alpha = Math.round(repNorm * 10);    // e.g. rep=74 → alpha=7
  const beta = Math.round((1 - repNorm) * 10) + 1;  // lower bound 1
  const uncertainty = Math.max(0.06, 0.20 - repNorm * 0.15);
  const eloStart = 1200 + Math.round((reputation - 50) * 5); // 1200–1360

  const agent: Agent = {
    id,
    name: name.endsWith("Agent") ? name : `${name}Agent`,
    role,
    provider,
    skills,
    price,
    reputation,
    factuality: parseFloat((repNorm * 0.85 + 0.10).toFixed(3)),
    usefulness: parseFloat((repNorm * 0.85 + 0.12).toFixed(3)),
    collaboration: parseFloat((repNorm * 0.80 + 0.12).toFixed(3)),
    latencyAvg: 2.0,
    status: "idle",
    alpha,
    beta,
    meanReward: repNorm,
    uncertainty,
    runs: 0,
    wins: 0,
    losses: 0,
    elo: eloStart,
    ucbScore: bayesianMean,
    graphTrust: parseFloat((repNorm * 0.60 + 0.10).toFixed(3)),
    bayesianMean,
  };

  await addCustomAgent(agent);
  return NextResponse.json({ agent }, { status: 201 });
}
