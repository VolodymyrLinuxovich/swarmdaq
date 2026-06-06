import { NextResponse } from "next/server";
import { removeCustomAgent, getCustomAgents } from "@/lib/memory";

export async function DELETE(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;

  if (!agentId.startsWith("custom_")) {
    return NextResponse.json({ error: "can only delete custom agents" }, { status: 403 });
  }

  const existing = await getCustomAgents();
  if (!existing.find((a) => a.id === agentId)) {
    return NextResponse.json({ error: "agent not found" }, { status: 404 });
  }

  await removeCustomAgent(agentId);
  return NextResponse.json({ ok: true });
}
