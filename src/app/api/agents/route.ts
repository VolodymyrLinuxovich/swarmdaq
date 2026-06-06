import { NextResponse } from "next/server";
import { getAgents, getLeaderboard } from "@/lib/memory";

export async function GET() {
  const [agents, leaderboard] = await Promise.all([getAgents(), getLeaderboard()]);
  return NextResponse.json({ agents, leaderboard });
}
