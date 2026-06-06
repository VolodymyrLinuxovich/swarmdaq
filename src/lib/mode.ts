export type ExecMode = "LIVE" | "SEEDED_DEMO" | "FALLBACK";

export function getExecMode(): ExecMode {
  const forced = process.env.SWARMDAQ_MODE;
  if (forced === "SEEDED_DEMO") return "SEEDED_DEMO";
  if (forced === "FALLBACK") return "FALLBACK";
  const hasKey = !!(process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY);
  return hasKey ? "LIVE" : "FALLBACK";
}
