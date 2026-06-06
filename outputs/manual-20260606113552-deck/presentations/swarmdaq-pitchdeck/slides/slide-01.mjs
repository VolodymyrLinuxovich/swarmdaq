import { base, chip, ellipse, finish, line, metric, node, rect, t, C } from "./common.mjs";

export async function slide01(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, { page: 1, source: "Source: SwarmDAQ repo, paper, and live demo." }),
    ...chip("LIVE TECHNICAL DEMO", 44, 92, 180, C.green),
    t("SwarmDAQ", 44, 154, 560, 82, 74, C.green, { bold: true }),
    t("A market-based performance exchange for self-improving AI agent swarms.", 50, 240, 610, 72, 29, C.text, { bold: true, leading: 1.02 }),
    t("Agents bid on tasks. A MarketMaker routes with math. Weave traces the run. Evaluation updates reputation memory. The next swarm is smarter.", 52, 332, 560, 92, 20, C.muted, { leading: 1.16 }),
    ...metric("9", "specialized agents with persistent market state", 52, 502, 210, C.green),
    ...metric("7+", "routing signals beyond prompt selection", 304, 502, 250, C.blue),
    ...metric("4", "feedback loop", 596, 502, 128, C.amber),
    rect(730, 90, 470, 500, "#06110E", "#17362D", 6),
    ellipse(920, 294, 250, 250, "#00FF880D", "#00FF8844"),
    ellipse(920, 294, 160, 160, "#00A3FF10", "#00A3FF55"),
    ...node("MarketMaker", "weighted score: skill, trust, UCB, bid, Elo, graph, cost, latency", 810, 248, 220, 92, C.green),
    ...node("Evaluator", "quality, factuality, usefulness, actionability, collaboration", 850, 110, 180, 84, C.amber),
    ...node("Memory", "Redis or in-memory: Beta, Elo, task history, graph trust", 970, 400, 180, 84, C.blue),
    ...node("Agents", "planner, research, verifier, builder, pitch, skeptic", 760, 410, 190, 84, C.purple),
    line(940, 248, 940, 194, C.hair, 2),
    line(1000, 342, 1040, 400, C.hair, 2),
    line(850, 340, 835, 410, C.hair, 2),
    t("performance market", 795, 552, 330, 28, 13, C.dim, { align: "center" }),
  ];
  return finish(slide, e);
}
