import { base, finish, line, rect, t, C } from "./common.mjs";

export async function slide09(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, {
      kicker: "wedge",
      title: "The wedge is trust infrastructure for the agent economy.",
      page: 9,
      source: "Source: project README, paper limitations, and implemented roadmap surface.",
    }),
    rect(70, 220, 280, 280, "#100D05", "#FFB02055", 5),
    t("Why now", 96, 248, 160, 24, 18, C.amber, { bold: true }),
    t("Agent supply is exploding, but buyers still lack transparent performance, routing, and failure memory.", 96, 300, 210, 112, 24, C.text, { bold: true, leading: 1.08 }),
    rect(430, 220, 280, 280, "#06110E", "#00FF8855", 5),
    t("Why this wins", 456, 248, 180, 24, 18, C.green, { bold: true }),
    t("SwarmDAQ turns each run into market evidence: bids, traces, evals, reputation deltas, and collaboration memory.", 456, 300, 210, 112, 23, C.text, { bold: true, leading: 1.08 }),
    rect(790, 220, 280, 280, "#06101A", "#00A3FF55", 5),
    t("What expands", 816, 248, 170, 24, 18, C.blue, { bold: true }),
    t("External benchmarks, larger agent catalogs, real budgets, policy constraints, and audited production traces.", 816, 300, 210, 112, 23, C.text, { bold: true, leading: 1.08 }),
    line(350, 360, 430, 360, C.hair, 2),
    line(710, 360, 790, 360, C.hair, 2),
    rect(70, 565, 1000, 44, "#0D1714", "#00FF883F", 4),
    t("Positioning: not a chatbot, not a generic agent framework - the exchange layer that decides which agents are worth hiring.", 94, 577, 920, 18, 17, C.text, { bold: true }),
  ];
  return finish(slide, e);
}
