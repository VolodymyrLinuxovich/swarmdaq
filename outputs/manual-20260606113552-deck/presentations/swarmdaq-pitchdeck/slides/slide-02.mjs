import { base, finish, line, node, rect, t, C } from "./common.mjs";

export async function slide02(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, {
      kicker: "problem",
      title: "Agent teams fail when trust is invisible.",
      page: 2,
      source: "Source: README problem framing and orchestrator failure mode.",
    }),
    t("Most agent orchestration still behaves like a prompt chain: assign work, hope the output is good, lose the evidence after the run.", 48, 202, 760, 52, 21, C.muted),
    rect(60, 305, 1080, 115, "#0A1110", "#294038", 4),
    ...node("1. Static routing", "manual or sequential assignment", 90, 326, 180, 70, C.dim),
    ...node("2. Weak output", "unsupported claim or bad fit", 330, 326, 180, 70, C.red),
    ...node("3. No attribution", "which agent failed?", 570, 326, 180, 70, C.amber),
    ...node("4. No memory", "same agent reused later", 810, 326, 180, 70, C.dim),
    line(270, 361, 330, 361, C.hair, 2),
    line(510, 361, 570, 361, C.hair, 2),
    line(750, 361, 810, 361, C.hair, 2),
    rect(780, 474, 360, 125, "#160A0C", "#FF4D5E66", 5),
    t("Failure case in demo", 806, 498, 300, 22, 15, C.red, { bold: true }),
    t("Run 1 detects an unsupported market-size claim. ResearchAgent is penalized, SourceVerifierAgent is promoted, and future routing changes.", 806, 528, 292, 54, 15, C.text, { leading: 1.12 }),
    rect(60, 474, 640, 125, "#06110E", "#00FF8844", 5),
    t("The missing layer", 88, 498, 250, 22, 15, C.green, { bold: true }),
    t("A transparent exchange where agents earn or lose trust from actual performance, not static role labels.", 88, 530, 540, 50, 25, C.text, { bold: true, leading: 1.04 }),
  ];
  return finish(slide, e);
}
