import { base, finish, line, node, rect, t, C } from "./common.mjs";

export async function slide03(presentation) {
  const slide = presentation.slides.add();
  const loopShift = 42;
  const stages = [
    ["Mission", "user intent enters the system", 76, 300, C.amber],
    ["Task graph", "PlannerAgent decomposes work", 250, 210, C.blue],
    ["Agent bids", "confidence, quality, cost, latency", 460, 210, C.green],
    ["MarketMaker", "weighted selection function", 690, 300, C.green],
    ["Execution", "Gemini or deterministic fallback", 460, 430, C.purple],
    ["Evaluation", "six dimensions scored", 250, 430, C.amber],
    ["Memory", "Beta, Elo, graph trust, task history", 76, 430, C.blue],
  ];
  const e = [
    ...base(slide, {
      kicker: "solution",
      title: "The product is a market loop, not another agent.",
      page: 3,
      source: "Source: src/lib/orchestrator.ts, src/lib/memory.ts, src/lib/trace.ts.",
    }),
    t("Each mission becomes a repeated decision market: bid, select, execute, trace, evaluate, update.", 48, 206, 740, 28, 16, C.muted),
    rect(46, 316, 860, 250, "#05100D", "#193A31", 6),
    ...stages.flatMap(([label, sub, x, y, color], i) => [
      ...node(`${i + 1}. ${label}`, sub, x, y + loopShift, label === "MarketMaker" ? 178 : 150, 68, color),
    ]),
    line(226, 377, 250, 302, C.hair, 2),
    line(400, 287, 460, 287, C.hair, 2),
    line(610, 287, 690, 357, C.hair, 2),
    line(690, 427, 610, 507, C.hair, 2),
    line(460, 507, 400, 507, C.hair, 2),
    line(250, 507, 226, 507, C.hair, 2),
    line(151, 472, 151, 412, C.hair, 2),
    rect(960, 205, 235, 300, "#0D1714", "#00FF8844", 5),
    t("Market state", 986, 232, 160, 22, 17, C.green, { bold: true }),
    t("Each run leaves evidence behind:", 986, 270, 178, 34, 15, C.muted),
    t("reputation", 1000, 326, 120, 22, 18, C.text, { bold: true }),
    t("uncertainty", 1000, 368, 120, 22, 18, C.text, { bold: true }),
    t("pairwise rating", 1000, 410, 150, 22, 18, C.text, { bold: true }),
    t("collaboration graph", 1000, 452, 170, 22, 18, C.text, { bold: true }),
    line(986, 318, 1150, 318, C.green, 1.5),
    line(986, 360, 1150, 360, C.blue, 1.5),
    line(986, 402, 1150, 402, C.amber, 1.5),
    line(986, 444, 1150, 444, C.purple, 1.5),
  ];
  return finish(slide, e);
}
