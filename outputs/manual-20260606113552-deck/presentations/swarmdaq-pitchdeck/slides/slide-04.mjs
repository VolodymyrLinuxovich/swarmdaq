import { base, finish, line, node, rect, t, C } from "./common.mjs";

export async function slide04(presentation) {
  const slide = presentation.slides.add();
  const e = [
    ...base(slide, {
      kicker: "architecture",
      title: "The implementation already spans UI, routing, tracing, and memory.",
      page: 4,
      source: "Source: Next.js app routes, lib/orchestrator.ts, lib/gemini.ts, lib/memory.ts.",
    }),
    rect(54, 205, 1080, 320, "#05100D", "#1C352E", 6),
    ...node("Next.js frontend", "landing, architecture, live demo, benchmark suite", 82, 244, 180, 86, C.blue),
    ...node("API routes", "/api/mission, /agents, /traces, /reset-demo", 305, 244, 180, 86, C.green),
    ...node("Orchestrator", "task planning, bidding, selection, execution, reputation", 528, 244, 190, 86, C.amber),
    ...node("Execution", "Gemini 2.5 Flash with deterministic fallback", 762, 244, 180, 86, C.purple),
    ...node("Evaluator", "quality, factuality, usefulness, specificity, actionability, collaboration", 305, 405, 180, 86, C.amber),
    ...node("Trace layer", "Weave integration plus local trace events", 528, 405, 190, 86, C.blue),
    ...node("Memory", "Upstash Redis or in-memory state", 762, 405, 180, 86, C.green),
    line(262, 287, 305, 287, C.hair, 2),
    line(485, 287, 528, 287, C.hair, 2),
    line(718, 287, 762, 287, C.hair, 2),
    line(852, 330, 852, 405, C.hair, 2),
    line(762, 448, 718, 448, C.hair, 2),
    line(528, 448, 485, 448, C.hair, 2),
    line(395, 405, 395, 330, C.hair, 2),
    rect(82, 560, 915, 58, "#071411", "#00FF8844", 4),
    t("Key design choice: every production dependency has a fallback path, so the demo remains usable without secrets.", 108, 577, 840, 28, 20, C.text, { bold: true }),
  ];
  return finish(slide, e);
}
