import { NextResponse } from "next/server";
import { getRecentMissions, getTotalMissionCount } from "@/lib/marketHistory";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

  const [missions, total] = await Promise.all([
    getRecentMissions(limit),
    getTotalMissionCount(),
  ]);

  return NextResponse.json({ missions, total });
}
