import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/memory";
import { clearTraces } from "@/lib/trace";
import { resetTrust } from "@/lib/math/graphTrust";
import { clearMarketHistory } from "@/lib/marketHistory";

export async function POST() {
  await resetDemo();
  await clearMarketHistory();
  clearTraces();
  resetTrust();
  return NextResponse.json({ ok: true, message: "Demo reset to initial state" });
}
