import { base, finish, line, rect, t, C } from "./common.mjs";

export async function slide08(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, {
      kicker: "product surface",
      title: "The dashboard makes the market inspectable.",
      page: 8,
      source: "Source: src/app/demo/page.tsx.",
    }),
    rect(68, 205, 1035, 410, "#050908", "#18342C", 8),
    rect(92, 232, 700, 52, "#081411", "#00FF8844", 4),
    t("Mission: build a launch plan for an AI product...", 116, 249, 550, 18, 16, C.text, { bold: true }),
    rect(820, 232, 250, 52, "#0D1714", "#00A3FF44", 4),
    t("Run 4 / 96", 844, 247, 170, 22, 23, C.blue, { bold: true }),
    rect(92, 314, 250, 245, "#07110F", "#263D35", 5),
    t("Agent registry", 116, 338, 160, 20, 16, C.green, { bold: true }),
    rect(374, 314, 250, 245, "#07110F", "#263D35", 5),
    t("MarketMaker log", 398, 338, 180, 20, 16, C.blue, { bold: true }),
    rect(656, 314, 414, 245, "#07110F", "#263D35", 5),
    t("Trace + contribution", 680, 338, 210, 20, 16, C.amber, { bold: true }),
    t("Weave calls, token totals, latency, evaluation scores, Shapley-style contribution ledger, trust graph, and reputation deltas all render in one workflow.", 680, 382, 335, 70, 17, C.text, { leading: 1.14 }),
    rect(680, 490, 320, 14, "#00FF8866", "none"),
    rect(680, 515, 250, 14, "#00A3FF66", "none"),
    rect(680, 540, 190, 14, "#FFB02066", "none"),
    t("The user can see why the swarm changed.", 84, 642, 650, 26, 24, C.text, { bold: true }),
  ];

  ["Skeptic 93", "SourceVerifier 91", "MarketMaker 92", "Pitch 86", "Research 78"].forEach((v, i) => {
    e.push(t(v, 118, 374 + i * 32, 145, 18, 14, i === 4 ? C.red : C.text));
    e.push(rect(246, 381 + i * 32, i === 4 ? 95 : 130 + i * 6, 5, i === 4 ? C.red : C.green, "none"));
  });

  ["market_research -> verifier", "pitch_script -> pitch", "risk_review -> skeptic", "final_eval -> evaluator"].forEach((v, i) => {
    e.push(t(v, 398, 377 + i * 39, 185, 18, 13, C.text));
    e.push(line(398, 402 + i * 39, 590, 402 + i * 39, C.hair, 1));
  });

  return finish(slide, e);
}
