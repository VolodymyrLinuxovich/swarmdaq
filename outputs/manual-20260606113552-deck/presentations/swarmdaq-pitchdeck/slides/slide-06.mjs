import { base, finish, rect, t, C } from "./common.mjs";

const agents = [
  ["Planner", "decomposition", "88", C.blue],
  ["Research", "market analysis", "78", C.red],
  ["SourceVerifier", "claim validation", "91", C.green],
  ["Builder", "product synthesis", "80", C.blue],
  ["Pitch", "narrative", "86", C.amber],
  ["Skeptic", "risk analysis", "93", C.green],
  ["Evaluator", "quality scoring", "90", C.amber],
  ["MarketMaker", "routing", "92", C.purple],
  ["Reputation", "memory update", "89", C.green],
];

export async function slide06(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, {
      kicker: "agent market",
      title: "Agents carry market state like real participants.",
      page: 6,
      source: "Source: src/lib/agents.ts and src/lib/types.ts.",
    }),
    t("Each agent is more than a role prompt: it has price, latency, factuality, collaboration, Beta trust, uncertainty, Elo, runs, wins, and losses.", 48, 202, 800, 50, 20, C.muted),
    rect(58, 282, 1060, 318, "#06110E", "#1C352E", 6),
    t("agent", 90, 306, 150, 18, 12, C.dim, { bold: true }),
    t("role", 290, 306, 190, 18, 12, C.dim, { bold: true }),
    t("rep", 545, 306, 50, 18, 12, C.dim, { bold: true }),
    t("market state fields", 655, 306, 220, 18, 12, C.dim, { bold: true }),
    ...agents.flatMap(([name, role, rep, color], i) => {
      const y = 338 + i * 27;
      return [
        rect(82, y + 7, 8, 8, color, "none"),
        t(name, 102, y, 150, 20, 14, C.text, { bold: true }),
        t(role, 290, y, 200, 20, 13, C.muted),
        t(rep, 548, y, 42, 20, 13, color, { bold: true }),
        rect(655, y + 7, Number(rep) * 2.4, 7, `${color}66`, "none"),
        t("alpha/beta  |  Elo  |  UCB  |  uncertainty  |  graph trust", 900, y, 170, 20, 10.5, C.dim),
      ];
    }),
    rect(58, 630, 1060, 38, "#0C1714", "#00A3FF44", 3),
    t("Routing becomes inspectable because every selected agent has a history, a price, a risk profile, and an explanation.", 82, 640, 980, 18, 16, C.text, { bold: true }),
  ];
  return finish(slide, e);
}
