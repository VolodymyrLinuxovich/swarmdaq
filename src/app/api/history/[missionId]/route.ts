import { NextResponse } from "next/server";
import { getMissionById, getMissionEvents } from "@/lib/marketHistory";

export async function GET(_req: Request, { params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params;
  const [mission, events] = await Promise.all([
    getMissionById(missionId),
    getMissionEvents(missionId),
  ]);

  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  return NextResponse.json({ mission, events });
}
