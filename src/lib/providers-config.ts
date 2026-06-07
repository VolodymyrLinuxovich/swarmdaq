// Browser-safe provider config — no Node.js imports
export type LLMProvider = "gemini" | "openai" | "anthropic";

export const AGENT_PROVIDER: Record<string, LLMProvider> = {
  planner:      "gemini",
  codex:        "openai",
  claude:       "anthropic",
  gemini:       "gemini",
  market_maker: "gemini",
  evaluator:    "anthropic",
  reputation:   "gemini",
};

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  gemini:    "Gemini 2.5 Flash",
  openai:    "GPT-5.5",
  anthropic: "Claude Sonnet",
};

export const PROVIDER_COLORS: Record<LLMProvider, string> = {
  gemini:    "#00aaff",
  openai:    "#00ff88",
  anthropic: "#f97316",
};
