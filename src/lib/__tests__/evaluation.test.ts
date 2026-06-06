import { describe, it, expect } from "vitest";
import { parseStructuredEval, computeLocalRubric, computeOverall } from "../evaluation";
import type { Agent } from "../types";

// Minimal Agent factory
function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test",
    name: "TestAgent",
    role: "tester",
    skills: [],
    price: 0.01,
    reputation: 70,
    factuality: 0.7,
    usefulness: 0.7,
    collaboration: 0.7,
    latencyAvg: 1,
    status: "idle",
    alpha: 2,
    beta: 1,
    meanReward: 0.7,
    uncertainty: 0.1,
    runs: 5,
    wins: 3,
    losses: 1,
    elo: 1450,
    ucbScore: 0.5,
    graphTrust: 0.5,
    bayesianMean: 0.7,
    ...overrides,
  };
}

describe("parseStructuredEval", () => {
  it("parses valid JSON with all 6 dimensions", () => {
    const text = `{"quality":85,"factuality":90,"usefulness":80,"specificity":75,"actionability":82,"collaboration":78}`;
    const result = parseStructuredEval(text);
    expect(result).not.toBeNull();
    expect(result!.quality).toBe(85);
    expect(result!.factuality).toBe(90);
    expect(result!.usefulness).toBe(80);
    expect(result!.specificity).toBe(75);
    expect(result!.actionability).toBe(82);
    expect(result!.collaboration).toBe(78);
  });

  it("computes overall when JSON lacks it", () => {
    const text = `{"quality":80,"factuality":80,"usefulness":80,"specificity":80,"actionability":80,"collaboration":80}`;
    const result = parseStructuredEval(text);
    expect(result).not.toBeNull();
    const expected = computeOverall({ quality: 80, factuality: 80, usefulness: 80, specificity: 80, actionability: 80, collaboration: 80 });
    expect(result!.overall).toBe(expected);
  });

  it("returns null for invalid JSON", () => {
    expect(parseStructuredEval("not json at all")).toBeNull();
  });

  it("returns null when dimensions are missing", () => {
    // only 3 dims
    const text = `{"quality":80,"factuality":80,"usefulness":80}`;
    expect(parseStructuredEval(text)).toBeNull();
  });

  it("returns null when a dimension is non-numeric", () => {
    const text = `{"quality":"high","factuality":80,"usefulness":80,"specificity":80,"actionability":80,"collaboration":80}`;
    expect(parseStructuredEval(text)).toBeNull();
  });

  it("parses JSON embedded in surrounding prose", () => {
    const text = `Here are my scores: {"quality":70,"factuality":65,"usefulness":72,"specificity":68,"actionability":74,"collaboration":71} end of output.`;
    const result = parseStructuredEval(text);
    expect(result).not.toBeNull();
    expect(result!.quality).toBe(70);
  });
});

describe("computeLocalRubric", () => {
  it("boosts factuality when citations are present", () => {
    const outputsWithCitations: Record<string, string> = {
      market_research: "According to MLH 2024 survey (n=12400), the market is growing. HolonIQ data supports this.",
    };
    const outputsNoCitations: Record<string, string> = {
      market_research: "The market is growing fast with lots of opportunity.",
    };
    const agents = [makeAgent({ id: "research", name: "ResearchAgent" })];

    const withCit = computeLocalRubric(outputsWithCitations, agents);
    const noCit = computeLocalRubric(outputsNoCitations, agents);

    expect(withCit.factuality).toBeGreaterThan(noCit.factuality);
  });

  it("boosts factuality when source_verifier agent is present", () => {
    const outputs: Record<string, string> = {
      market_research: "Market data shows growth trends.",
    };
    const withVerifier = [
      makeAgent({ id: "research", name: "ResearchAgent" }),
      makeAgent({ id: "source_verifier", name: "SourceVerifierAgent" }),
    ];
    const withoutVerifier = [makeAgent({ id: "research", name: "ResearchAgent" })];

    const scoreWith = computeLocalRubric(outputs, withVerifier);
    const scoreWithout = computeLocalRubric(outputs, withoutVerifier);

    expect(scoreWith.factuality).toBeGreaterThan(scoreWithout.factuality);
  });

  it("overall equals computeOverall result", () => {
    const outputs: Record<string, string> = {
      market_research: "Some analysis with headers\n## Section\n- bullet 1\n- bullet 2\nThe 25% growth rate with $5M ARR shows traction.",
      pitch_script: "Last week at MIT, we raised our hands. Next step: series A by month 3.",
    };
    const agents = [
      makeAgent({ id: "research" }),
      makeAgent({ id: "pitch" }),
      makeAgent({ id: "skeptic" }),
    ];

    const result = computeLocalRubric(outputs, agents);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { overall: _overall, ...dims } = result;
    const expected = computeOverall(dims);
    expect(result.overall).toBe(expected);
  });

  it("unverified flag reduces factuality", () => {
    const outputsClean: Record<string, string> = {
      market_research: "Solid research with data.",
    };
    const outputsFlagged: Record<string, string> = {
      market_research: "The claim is speculative without source and needs verification.",
    };
    const agents = [makeAgent({ id: "research" })];

    const clean = computeLocalRubric(outputsClean, agents);
    const flagged = computeLocalRubric(outputsFlagged, agents);

    expect(flagged.factuality).toBeLessThan(clean.factuality);
  });
});

describe("computeOverall", () => {
  it("applies correct weights", () => {
    const dims = {
      factuality: 100,
      quality: 0,
      usefulness: 0,
      specificity: 0,
      actionability: 0,
      collaboration: 0,
    };
    // factuality weight is 0.20
    expect(computeOverall(dims)).toBe(20);
  });

  it("all 100s gives 100", () => {
    const dims = {
      quality: 100,
      factuality: 100,
      usefulness: 100,
      specificity: 100,
      actionability: 100,
      collaboration: 100,
    };
    // 100*(0.20+0.20+0.18+0.15+0.15+0.12) = 100*1.00 = 100
    expect(computeOverall(dims)).toBe(100);
  });
});
