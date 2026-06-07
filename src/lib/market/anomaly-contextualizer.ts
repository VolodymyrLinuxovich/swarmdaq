import type { Agent } from "../types";
import { generateAgentOutput } from "../gemini";
import type { PriceAnomalyResult, PricePatternLabel } from "./price-anomaly";

export interface AnomalyContextInput {
  taskType: string;
  selectedAgent: Agent;
  bidPrice: number;
  clearingPrice: number;
  anomaly: PriceAnomalyResult;
  recentEvalScore?: number;
  taskComplexity: number;
  mem0Context?: string;
}

export interface AnomalyContext {
  summary: string;
  marketInterpretation: string;
  riskLevel: "low" | "medium" | "high";
  isJustified: boolean;
  recommendedAction: string;
  judgeFriendlyExplanation: string;
}

function parseContextJson(text: string): AnomalyContext | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Partial<AnomalyContext>;
    if (!parsed.summary || !parsed.marketInterpretation || !parsed.riskLevel || !parsed.recommendedAction || !parsed.judgeFriendlyExplanation) {
      return null;
    }
    return {
      summary: parsed.summary,
      marketInterpretation: parsed.marketInterpretation,
      riskLevel: parsed.riskLevel,
      isJustified: Boolean(parsed.isJustified),
      recommendedAction: parsed.recommendedAction,
      judgeFriendlyExplanation: parsed.judgeFriendlyExplanation,
    };
  } catch {
    return null;
  }
}

function riskLevel(label: PricePatternLabel, pValue: number | null): "low" | "medium" | "high" {
  if (label === "NORMAL_PRICE" || label === "INSUFFICIENT_HISTORY") return "low";
  if (pValue !== null && pValue < 0.01) return "high";
  return "medium";
}

export function fallbackAnomalyContext(input: AnomalyContextInput): AnomalyContext {
  const { selectedAgent: agent, anomaly } = input;
  const isHighPrice = anomaly.label === "OVERPRICED_AGENT" || anomaly.label === "MARKET_SPIKE";
  const isJustified =
    !isHighPrice ||
    agent.reputation >= 86 ||
    agent.factuality >= 0.9 ||
    agent.uncertainty <= 0.08 ||
    input.taskComplexity >= 0.75;
  const medianText = anomaly.historicalMedian === null ? "limited history" : `$${anomaly.historicalMedian.toFixed(3)} median`;
  const percentile = anomaly.percentile === null ? "unknown percentile" : `${anomaly.percentile.toFixed(1)}th percentile`;
  const summary =
    `${agent.name} bid $${input.bidPrice.toFixed(3)} on ${input.taskType}; Redis classifies it as ${anomaly.label} (${percentile}, ${medianText}).`;

  return {
    summary,
    marketInterpretation: isJustified
      ? "The price pattern is unusual, but agent quality, factuality, uncertainty, or task complexity can justify paying above baseline."
      : "The price pattern is unusual and is not clearly supported by reputation, factuality, uncertainty, or task complexity.",
    riskLevel: riskLevel(anomaly.label, anomaly.pValue),
    isJustified,
    recommendedAction: isJustified
      ? "Allow MarketMaker to consider the agent; monitor evaluation outcome and update reputation after the run."
      : "Prefer a lower-priced candidate unless skill match or task constraints require this agent.",
    judgeFriendlyExplanation: isJustified
      ? `${agent.name}'s price is statistically unusual, but SwarmDAQ does not blindly penalize expensive agents; it checks whether quality signals justify the premium.`
      : `${agent.name}'s price is statistically unusual and SwarmDAQ flags it as a market risk before routing.`,
  };
}

export async function contextualizeMarketAnomaly(input: AnomalyContextInput): Promise<AnomalyContext> {
  const fallback = fallbackAnomalyContext(input);
  if (input.anomaly.label === "NORMAL_PRICE" || input.anomaly.label === "INSUFFICIENT_HISTORY") {
    return fallback;
  }

  const mem0Section = input.mem0Context
    ? `\nAgent memory context:\n${input.mem0Context}`
    : "";

  const prompt = `Explain this SwarmDAQ market anomaly as strict JSON only.

Task type: ${input.taskType}
Selected agent: ${input.selectedAgent.name}
Bid price: ${input.bidPrice}
Clearing price: ${input.clearingPrice}
P-value: ${input.anomaly.pValue}
Percentile: ${input.anomaly.percentile}
Anomaly label: ${input.anomaly.label}
Agent reputation: ${input.selectedAgent.reputation}
Agent factuality: ${input.selectedAgent.factuality}
Agent uncertainty: ${input.selectedAgent.uncertainty}
Recent eval score: ${input.recentEvalScore ?? "unknown"}
Task complexity: ${input.taskComplexity}${mem0Section}

Return:
{
  "summary": "...",
  "marketInterpretation": "...",
  "riskLevel": "low | medium | high",
  "isJustified": true,
  "recommendedAction": "...",
  "judgeFriendlyExplanation": "..."
}`;

  try {
    const text = await generateAgentOutput({
      agentName: "MarketMakerAgent",
      role: "Explains Redis price anomalies for agent-market routing.",
      task: "market_anomaly_contextualization",
      mission: prompt,
      context: "Return strict JSON only. Do not include markdown.",
      jsonMode: true,
    });
    return parseContextJson(text) ?? fallback;
  } catch {
    return fallback;
  }
}
