import { base, finish, line, rect, t, C } from "./common.mjs";

const terms = [
  ["Skill", "task fit", "0.20", C.green],
  ["Reputation", "Beta mean", "0.18", C.blue],
  ["UCB", "explore/exploit", "0.16", C.purple],
  ["Bid", "utility", "0.14", C.green],
  ["Elo", "pairwise strength", "0.12", C.amber],
  ["GraphTrust", "collaboration hub", "0.08", C.blue],
  ["Cost / latency / risk", "penalty terms", "-0.20", C.red],
];

export async function slide05(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, {
      kicker: "routing math",
      title: "MarketMaker routes with a score, not vibes.",
      page: 5,
      source: "Source: src/lib/orchestrator.ts computeMarketMakerScore().",
    }),
    rect(60, 215, 555, 250, "#06110E", "#00FF8844", 6),
    t("Score_i =", 92, 247, 140, 36, 28, C.green, { bold: true }),
    t("w_s Skill_i + w_r Reputation_i + w_u UCB_i + w_b Bid_i + w_e Elo_i + w_g GraphTrust_i - w_c Cost_i - w_l Latency_i - w_unc Uncertainty_i", 92, 302, 470, 90, 22, C.text, { bold: true, leading: 1.12 }),
    t("The UI exposes the candidate list, component scores, and winner for each task.", 92, 413, 430, 30, 15, C.muted),
    rect(690, 195, 430, 360, "#08100E", "#243E36", 6),
    t("Implemented signal stack", 724, 222, 260, 24, 18, C.text, { bold: true }),
    ...terms.flatMap(([name, sub, weight, color], i) => {
      const y = 268 + i * 39;
      const width = Math.max(42, Math.abs(Number(weight)) * 520);
      return [
        t(weight, 724, y + 4, 54, 18, 13, color, { bold: true }),
        t(name, 790, y - 3, 170, 17, 12.5, C.text, { bold: true }),
        t(sub, 790, y + 14, 170, 14, 10.5, C.dim),
        rect(990, y + 4, width, 14, `${color}55`, "none", 0),
      ];
    }),
    line(690, 572, 1120, 572, C.hair, 1),
    t("Negative weights are explicit penalties, not hidden prompt preferences.", 724, 588, 330, 20, 13, C.muted),
  ];
  return finish(slide, e);
}
