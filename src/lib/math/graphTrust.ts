import { Agent } from "../types";

const DAMPING = 0.85;
const ITERATIONS = 10;

// Collaboration edges: [fromId, toId, weight]
// Updated after missions based on score improvements
let collaborationEdges: Map<string, number> = new Map();

function edgeKey(a: string, b: string): string {
  return `${a}|${b}`;
}

export function recordCollaboration(
  agentA: string,
  agentB: string,
  improvement: number
): void {
  const key = edgeKey(agentA, agentB);
  const current = collaborationEdges.get(key) ?? 0;
  collaborationEdges.set(key, current + Math.max(0, improvement));
}

export function computePageRank(agents: Agent[]): Record<string, number> {
  const N = agents.length;
  const ids = agents.map((a) => a.id);

  // Initialize uniform
  const pr: Record<string, number> = {};
  for (const id of ids) pr[id] = 1 / N;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const newPr: Record<string, number> = {};
    for (const id of ids) {
      let incomingSum = 0;
      for (const fromId of ids) {
        if (fromId === id) continue;
        const key = edgeKey(fromId, id);
        const weight = collaborationEdges.get(key) ?? 0;
        // Total outgoing weight from fromId
        const totalOut = ids.reduce((s, toId) => {
          if (toId === fromId) return s;
          return s + (collaborationEdges.get(edgeKey(fromId, toId)) ?? 0.01);
        }, 0);
        incomingSum += (pr[fromId] * (weight + 0.01)) / (totalOut + 0.01 * N);
      }
      newPr[id] = (1 - DAMPING) / N + DAMPING * incomingSum;
    }
    Object.assign(pr, newPr);
  }

  return pr;
}

export function initializeDefaultTrust(): void {
  // Pre-seed known good collaborations
  recordCollaboration("source_verifier", "research", 0.15);
  recordCollaboration("skeptic", "research", 0.08);
  recordCollaboration("evaluator", "planner", 0.10);
  recordCollaboration("pitch", "builder", 0.07);
  recordCollaboration("planner", "market_maker", 0.12);
}

export function resetTrust(): void {
  collaborationEdges = new Map();
  initializeDefaultTrust();
}

// Initialize on module load
initializeDefaultTrust();
