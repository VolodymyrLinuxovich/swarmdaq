import { base, chip, finish, line, rect, t, C } from "./common.mjs";

export async function slide10(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, { page: 10, source: "Assets: GitHub repo, live demo, LaTeX paper, generated PPTX deck." }),
    ...chip("CLOSE", 44, 90, 92, C.green),
    t("Make agent routing auditable.", 48, 145, 840, 118, 52, C.text, { bold: true, leading: 0.98 }),
    t("Every agent gets a market price, performance history, trace, and reason to improve.", 52, 292, 720, 56, 24, C.green, { bold: true, leading: 1.05 }),
    rect(64, 390, 275, 118, "#06110E", "#00FF8855", 5),
    t("Live demo", 90, 418, 150, 24, 18, C.green, { bold: true }),
    t("swarmdaq.vercel.app", 90, 456, 200, 20, 16, C.text),
    rect(374, 390, 275, 118, "#06101A", "#00A3FF55", 5),
    t("Repository", 400, 418, 150, 24, 18, C.blue, { bold: true }),
    t("github.com/VolodymyrLinuxovich/swarmdaq", 400, 456, 205, 34, 14, C.text),
    rect(684, 390, 275, 118, "#100D05", "#FFB02055", 5),
    t("Scientific paper", 710, 418, 170, 24, 18, C.amber, { bold: true }),
    t("paper/main.tex + Actions PDF artifact", 710, 456, 200, 34, 15, C.text),
    line(64, 550, 960, 550, C.hair, 1),
    t("Next milestones: external benchmark suite, richer agent catalog, budget-aware clearing, adversarial bid tests, production trace corpus.", 66, 574, 900, 40, 18, C.muted),
  ];
  return finish(slide, e);
}
