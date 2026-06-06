// Browser-safe provider config — no Node.js imports
export type LLMProvider = "gemini" | "openai" | "anthropic";

export const AGENT_PROVIDER: Record<string, LLMProvider> = {
  planner:        "gemini",
  research:       "gemini",
  source_verifier:"gemini",
  market_maker:   "gemini",
  reputation:     "gemini",
  builder:        "openai",
  pitch:          "anthropic",
  skeptic:        "anthropic",
  evaluator:      "anthropic",
};

export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  gemini:    "Gemini 2.5 Flash",
  openai:    "GPT-4o",
  anthropic: "Claude Sonnet",
};

export const PROVIDER_COLORS: Record<LLMProvider, string> = {
  gemini:    "#00aaff",
  openai:    "#00ff88",
  anthropic: "#f97316",
};
