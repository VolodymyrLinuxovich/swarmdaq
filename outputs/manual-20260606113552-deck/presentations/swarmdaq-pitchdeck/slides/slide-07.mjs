import { base, finish, line, rect, t, C } from "./common.mjs";

const runs = [
  ["Run 1", 74, "failure detected", C.red],
  ["Run 2", 91, "market learned", C.green],
  ["Run 3", 85, "over-rotation", C.amber],
  ["Run 4", 96, "calibrated recovery", C.blue],
];

export async function slide07(presentation) {
  const slide = presentation.slides.add();
  const chartX = 92;
  const chartY = 250;
  const chartH = 300;
  const max = 100;
  const e = [
    ...base(slide, {
      kicker: "demo proof",
      title: "The demo shows learning, regression detection, and recovery.",
      page: 7,
      source: "Source: internal demo values from src/lib/orchestrator.ts and /api/mission fallback.",
    }),
    t("This is not an external benchmark. It is the product proof loop: evaluation changes memory, and memory changes routing.", 48, 202, 850, 44, 19, C.muted),
    rect(70, 242, 760, 340, "#06110E", "#1D362F", 6),
    line(chartX, chartY + chartH, chartX + 670, chartY + chartH, C.hair, 1.2),
    line(chartX, chartY, chartX, chartY + chartH, C.hair, 1.2),
    ...runs.flatMap(([label, score, note, color], i) => {
      const x = chartX + 95 + i * 155;
      const h = (score / max) * 245;
      const y = chartY + chartH - h;
      return [
        rect(x, y, 74, h, `${color}66`, "none", 2),
        rect(x, y, 74, 4, color, "none"),
        t(String(score), x - 2, y - 34, 78, 28, 26, color, { bold: true, align: "center" }),
        t(label, x - 4, chartY + chartH + 18, 82, 20, 13, C.text, { bold: true, align: "center" }),
        t(note, x - 34, chartY + chartH + 39, 145, 28, 11.5, C.muted, { align: "center" }),
      ];
    }),
    t("overall score", 108, 258, 140, 20, 12, C.dim),
    rect(890, 265, 280, 260, "#0D1714", "#00FF8844", 5),
    t("What the arc proves", 918, 294, 190, 24, 18, C.green, { bold: true }),
    t("Run 2 promotes SourceVerifierAgent after a factuality failure.", 918, 342, 210, 42, 15, C.text),
    t("Run 3 exposes over-optimization: skepticism hurts narrative quality.", 918, 405, 218, 42, 15, C.text),
    t("Run 4 rebalances the swarm and reaches the best internal score.", 918, 468, 218, 42, 15, C.text),
  ];
  return finish(slide, e);
}
