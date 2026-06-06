import { NextResponse } from "next/server";
import { getAgents } from "@/lib/memory";

function getLabel(agent: { bayesianMean: number; reputation: number; uncertainty: number }): string {
  if (agent.uncertainty > 0.12) return "WATCH";
  if (agent.bayesianMean > 0.84 && agent.reputation > 88 && agent.uncertainty < 0.09) return "BUY";
  if (agent.bayesianMean < 0.65 || agent.reputation < 75) return "SELL";
  return "HOLD";
}

export async function GET() {
  const agents = await getAgents();
  const sorted = [...agents].sort((a, b) => b.reputation - a.reputation);

  const leaderboard = sorted.map((a, i) => ({
    rank: i + 1,
    id: a.id,
    name: a.name,
    reputation: a.reputation,
    bayesianMean: parseFloat(a.bayesianMean.toFixed(4)),
    uncertainty: parseFloat(a.uncertainty.toFixed(4)),
    elo: a.elo,
    graphTrust: parseFloat(a.graphTrust.toFixed(4)),
    wins: a.wins,
    losses: a.losses,
    runs: a.runs,
    label: getLabel(a),
  }));

  return NextResponse.json({ leaderboard, updatedAt: Date.now() });
}
