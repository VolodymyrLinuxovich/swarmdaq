import { NextResponse } from "next/server";
import { getMarketFeed } from "@/lib/marketHistory";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const events = await getMarketFeed(limit);
  return NextResponse.json({ events, total: events.length });
}
