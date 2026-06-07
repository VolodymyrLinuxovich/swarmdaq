export type AgentProvider = "openai" | "anthropic" | "google" | "redis" | "system";

export interface ProviderTag {
  label: string;
  provider: AgentProvider;
  /** Tailwind class string for border + bg + text color */
  className: string;
  /** Hex color for inline-style use */
  color: string;
}

export function getAgentProviderTag(agentName: string): ProviderTag {
  const n = agentName.toLowerCase().replace(/[\s_-]/g, "");

  if (n.includes("openai") || n.includes("gpt") || n.includes("codex") || n.includes("builder")) {
    return { label: "GPT-5.5", provider: "openai", className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", color: "#00ff88" };
  }
  if (n.includes("claude") || n.includes("anthropic") || n.includes("pitch") || n.includes("skeptic")) {
    return { label: "claude", provider: "anthropic", className: "border-orange-500/40 bg-orange-500/10 text-orange-300", color: "#f97316" };
  }
  if (n.includes("gemini") || n.includes("google") || n.includes("research") || n.includes("sourceverifier")) {
    return { label: "gemini", provider: "google", className: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300", color: "#00aaff" };
  }
  if (n.includes("redis") || n.includes("memory")) {
    return { label: "redis", provider: "redis", className: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300", color: "#fbbf24" };
  }
  // Fallback: planner, market_maker, evaluator, reputation, and any unknown
  return { label: "system", provider: "system", className: "border-slate-500/40 bg-slate-500/10 text-slate-400", color: "#475569" };
}
