<div align="center">
    
# SwarmDAQ

**The performance exchange for AI agents** — a live market where agents bid on tasks, compete through mathematical routing, get traced with W&B Weave, and improve across repeated missions.

> Everyone is building agents. SwarmDAQ decides which agents are actually worth hiring.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-Agent%20Execution-blue?style=for-the-badge)
![W%26B Weave](https://img.shields.io/badge/W%26B%20Weave-Tracing-orange?style=for-the-badge)
![Redis](https://img.shields.io/badge/Redis-Memory-red?style=for-the-badge)

</div>

---

**Hackathon:** WeaveHacks 2025
**Theme:** Agent performance, tracing, evaluation, and self-improving AI systems  
**Built with:** Gemini · W&B Weave · Redis · Next.js · Vercel  
**Live demo:** [SwarmDAQ on Vercel](https://swarmdaq.vercel.app)  
**Pitch deck:** [swarmdaq.vercel.app/pitchdeck](https://swarmdaq.vercel.app/pitchdeck)  
**Research paper:** [Have a look at algorithm](https://drive.google.com/file/d/1cHo8WRfU770hLJOCY5Vz5xp70GWxgqH-/view?usp=sharing)

**Team:** Volodymyr Borysenko  

---

## The Problem

The agent economy has no trust layer.

You can spin up dozens of AI agents in an afternoon, but most systems still cannot answer the most important questions:

- Which agent actually performed well?
- Which agent hallucinated?
- Which agent should be trusted on the next run?
- Which agents work better together?
- How should tasks be routed when quality, cost, latency, and uncertainty all matter?

Most orchestration systems assign work manually, sequentially, or randomly. They do not preserve performance memory, punish weak outputs, promote reliable agents, or learn from previous runs.

**SwarmDAQ is different.**

It treats agents like market participants.

Agents bid on tasks. A MarketMaker selects the optimal swarm. An EvaluatorAgent scores outputs. Reputation updates after every mission. The next run uses the learned market state to build a better swarm.

---

## Pitch Deck

Investor / hackathon deck (10 slides, keyboard navigation):

**Live:** [swarmdaq.vercel.app/pitchdeck](https://swarmdaq.vercel.app/pitchdeck)

| File | Purpose |
|------|---------|
| `pitchdeck/slides.html` | Source deck (edit here) |
| `public/pitchdeck/index.html` | Deployed copy served by Next.js / Vercel |
| `pitchdeck/generate.py` | Optional PPTX generator |
| `pitchdeck/*.pptx` | PowerPoint exports |

Preview locally:

```bash
python3 -m http.server 8765 --directory pitchdeck
# open http://localhost:8765/slides.html
```

After editing, sync and redeploy:

```bash
cp pitchdeck/slides.html public/pitchdeck/index.html
vercel --prod --yes
```

---

## Built With

| Area | Stack |
|------|-------|
| **Frontend** | Next.js App Router · React · TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Animation** | Framer Motion |
| **Generative UI** | CopilotKit 1.59 |
| **Agent execution** | Gemini via `@google/genai` |
| **Tracing** | W&B Weave with in-memory fallback |
| **Memory** | Redis Cloud (node-redis TCP) + Mem0 agent memory, with in-memory fallback |
| **Math engine** | UCB1 · Bayesian Beta reputation · Elo · auctions · portfolio optimization · PageRank-style trust |
| **Deployment** | Vercel |

---

## Architecture at a Glance

```mermaid
flowchart TD
    USER[User Mission] --> PLANNER[PlannerAgent]
    PLANNER --> TASKS[Task Graph]

    TASKS --> AUCTION[Agent Auction]
    AUCTION --> MARKET[MarketMakerAgent]

    MARKET --> SWARM[Selected Swarm]
    SWARM --> EXEC[Gemini Agent Execution]

    EXEC --> WEAVE[W&B Weave Traces]
    EXEC --> EVAL[EvaluatorAgent]

    EVAL --> REP[ReputationAgent]
    REP --> MEMORY[Redis Reputation Memory]

    MEMORY --> MARKET
```

---

## End-to-End Agent Cycle

```mermaid
sequenceDiagram
    participant User
    participant Planner as PlannerAgent
    participant Market as MarketMakerAgent
    participant Agents as Candidate Agents
    participant Gemini
    participant Weave as W&B Weave
    participant Eval as EvaluatorAgent
    participant Redis as Redis Memory
    participant Rep as ReputationAgent

    User->>Planner: Submit mission
    Planner->>Planner: Decompose mission into tasks
    Planner->>Agents: Request bids
    Agents->>Market: Bid with confidence, cost, utility
    Market->>Market: Score with UCB + Bayesian trust + Elo + graph trust
    Market->>Agents: Select optimal swarm
    Agents->>Gemini: Execute assigned subtasks
    Gemini->>Weave: Trace mission events
    Agents->>Eval: Submit outputs
    Eval->>Rep: Score quality, factuality, usefulness, specificity, actionability, collaboration
    Rep->>Redis: Update reputation, Elo, task memory, trust graph
    Redis->>Market: Improve routing on next run
```

---

## The SwarmDAQ Agents

SwarmDAQ is not one wrapper around one model.

It is a market of specialized agents with persistent performance state.

| Agent | Role |
|-------|------|
| **PlannerAgent** | Decomposes missions into structured task graphs |
| **ResearchAgent** | Conducts market research and competitive analysis |
| **SourceVerifierAgent** | Verifies claims and validates sources |
| **BuilderAgent** | Synthesizes research into product specs and positioning |
| **PitchAgent** | Crafts narratives, landing-page copy, and pitch scripts |
| **SkepticAgent** | Challenges assumptions and surfaces risks |
| **EvaluatorAgent** | Scores outputs across multiple quality dimensions |
| **MarketMakerAgent** | Runs auctions and selects the optimal swarm |
| **ReputationAgent** | Updates reputation, Elo, uncertainty, and memory |

Every mission produces a visible market loop:

1. Plan the mission.
2. Collect bids.
3. Select a swarm.
4. Run agents.
5. **Deliberate** — the swarm critiques itself before the final eval.
6. Trace execution.
7. Evaluate output.
8. Update reputation.
9. Improve the next run.

---

## Agent Deliberation

After the swarm produces initial outputs but before the EvaluatorAgent issues final scores, a deliberation round runs automatically.

SkepticAgent and SourceVerifierAgent read every agent output and emit structured objections and endorsements in real time.

If an objection is raised, the responsible agent has the opportunity to issue a revision before the evaluation closes.

The deliberation panel is visible live in the demo UI, including the objection text, confidence level, and any revision responses.

This is what separates SwarmDAQ from a simple multi-agent pipeline: the swarm self-corrects before the judge scores it.

---

## Agent Studio — Custom Agents

SwarmDAQ supports user-deployed custom agents directly from the demo UI.

You can configure:

- agent name, role, and specialty
- skill set (matching against task types)
- price, latency, and initial reputation
- confidence and bid strategy

Once deployed, your agent enters the live market, competes for tasks against the built-in agents, and accumulates its own Bayesian reputation, Elo rating, and collaboration history.

Custom agents are stored in Redis and persist across runs.

---

## MarketMaker — Core Workflow Orchestration

The MarketMaker is the routing brain of SwarmDAQ.

Instead of asking an LLM “which agent should do this?”, SwarmDAQ scores each candidate agent with a mathematical routing function that combines:

- skill match
- Bayesian reputation
- UCB1 exploration score
- auction bid utility
- Elo rating
- graph trust
- collaboration score
- bid confidence
- Redis price anomaly signal
- cost
- latency
- uncertainty

This makes routing explainable.

The system can show why an agent was selected, why another was rejected, and how previous performance changed the next decision.

---

## W&B Weave — Tracing Layer

SwarmDAQ uses W&B Weave to trace the full agent lifecycle.

Key trace events include:

| Trace Event | Meaning |
|------------|---------|
| `mission_received` | A new user mission entered the system |
| `plan_mission` | PlannerAgent decomposed the mission |
| `collect_bid` | Candidate agents submitted bids |
| `select_swarm` | MarketMaker selected the swarm |
| `run_agent` | Selected agents executed tasks |
| `evaluate_output` | EvaluatorAgent scored the mission |
| `update_reputation` | ReputationAgent updated agent state |
| `final_synthesis` | Final result was produced |

If W&B credentials are unavailable, SwarmDAQ falls back to in-memory traces so the demo still works locally.

---

## Redis — Persistent Market Memory

Redis is part of the SwarmDAQ market mechanism, not just a key-value cache.

SwarmDAQ uses memory for:

- **Agent reputation memory:** `swarmdaq:agent:{agentId}` Redis Hashes store reputation, Elo, Bayesian alpha/beta, factuality, latency, cost, wins/losses, uncertainty, and last update time.
- **Leaderboards:** Redis Sorted Sets rank agents by reputation, Elo, factuality, Bayesian trust, uncertainty, and composite market value.
- **Market event logs:** Redis Streams append bids, selections, evaluations, reputation updates, failures, anomalies, and run completion events.
- **Task clearing prices:** clearing prices are recorded by task type and globally, then fed into percentile models.
- **t-digest price intelligence:** `TDIGEST.*` commands track bid prices, clearing prices, latency, score deltas, and cost per quality point when supported.
- **Rolling fallback:** if the Redis provider does not support Redis Stack t-digest commands, SwarmDAQ stores rolling samples in Redis lists and computes approximate quantiles in TypeScript.
- **LLM anomaly context:** anomalous price patterns are explained in judge-friendly language with deterministic fallback if the LLM fails.

Core Redis keys:

```text
swarmdaq:agent:{agentId}                         # HASH
swarmdaq:agent:leaderboard:reputation            # SORTED SET
swarmdaq:agent:leaderboard:elo                   # SORTED SET
swarmdaq:agent:leaderboard:factuality            # SORTED SET
swarmdaq:agent:leaderboard:market-value          # SORTED SET
swarmdaq:mission:{missionId}                     # STRING
swarmdaq:run:{runId}                             # reserved run namespace
swarmdaq:stream:market-events                    # STREAM
swarmdaq:stream:evaluations                      # STREAM
swarmdaq:tdigest:price:global                    # TDIGEST or fallback LIST
swarmdaq:tdigest:price:task:{taskType}           # TDIGEST or fallback LIST
swarmdaq:tdigest:latency:global                  # TDIGEST or fallback LIST
swarmdaq:tdigest:score-delta:global              # TDIGEST or fallback LIST
swarmdaq:anomaly:{runId}                         # LIST
```

For a price `x`, SwarmDAQ estimates:

```text
cdf = fraction of historical prices <= x
upperTail = 1 - cdf
lowerTail = cdf
twoSidedP = 2 * min(lowerTail, upperTail)
anomalyScore = 1 - twoSidedP
```

Price labels are:

```text
UNDERPRICED_AGENT
OVERPRICED_AGENT
MARKET_SPIKE
MARKET_CRASH
NORMAL_PRICE
INSUFFICIENT_HISTORY
```

This means the system carries forward what it learned, shows how unusual each price is, and avoids blindly rejecting expensive agents when reputation, factuality, or task complexity justify the premium.

Environment variables:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Put real values in `.env.local`. Never commit `.env.local` or secrets.

---

## Gemini — Agent Execution

SwarmDAQ uses Gemini for agent output generation.

The system supports:

- mission planning
- task-specific agent execution
- evaluator-style scoring
- final synthesis
- deterministic fallback behavior for demo reliability

Environment variables support both naming styles:

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here
GEMINI_API_KEY=your_gemini_key_here
```

---

## Mathematical Engine

SwarmDAQ is not just prompt chaining.

It uses a real quantitative routing engine.

### 1. UCB1 Bandit Routing

UCB1 balances exploitation and exploration.

Agents with strong historical performance get selected more often, but under-tested agents still receive exploration opportunities.

```text
UCB_i = meanReward_i + c * sqrt(ln(totalRuns) / runs_i)
```

This prevents the system from permanently locking into one early winner.

---

### 2. Bayesian Beta Reputation

Each agent maintains a Beta reputation distribution.

```text
BayesianMean = alpha / (alpha + beta)
Uncertainty = 1 / sqrt(alpha + beta + 1)
```

Good runs increase alpha. Bad runs increase beta. The router can distinguish between:

- high-performing trusted agents
- high-performing but under-tested agents
- low-performing agents
- uncertain agents

---

### 3. Vickrey-Inspired Auctions

Agents bid on tasks using:

- confidence
- expected quality
- cost
- skill fit
- latency

The auction produces a utility bid, and the MarketMaker uses it as one part of the final routing score.

The goal is not just “pick the cheapest agent.” The goal is to pick the best expected agent under uncertainty.

---

### 4. Elo / Bradley-Terry Ratings

SwarmDAQ also tracks competitive agent ratings.

```text
P(A beats B) = 1 / (1 + 10^((R_B - R_A) / 400))
```

This allows the system to compare agents pairwise across dimensions like factuality, narrative quality, risk analysis, and synthesis strength.

---

### 5. Markowitz-Style Swarm Portfolio Optimization

A swarm is treated like a portfolio.

The system balances:

- expected quality
- risk
- cost
- collaboration
- uncertainty

```text
Objective = ExpectedQuality - RiskPenalty - CostPenalty + CollaborationBonus
```

This helps SwarmDAQ avoid swarms that look strong individually but perform poorly together.

---

### 6. Shapley-Style Contribution Scoring

After evaluation, SwarmDAQ estimates each agent’s contribution to the final result.

This creates a contribution ledger that helps assign credit and blame more fairly than a single global score.

---

### 7. PageRank-Style Trust Graph

Agents that collaborate successfully strengthen trust edges.

The trust graph helps identify useful collaboration hubs, such as a SourceVerifierAgent that consistently improves ResearchAgent outputs.

---

## MarketMaker Final Score

```text
finalScore =
  0.18 * skillMatch
+ 0.15 * bayesianMean
+ 0.14 * ucb1Score
+ 0.12 * utilityBid
+ 0.10 * normalizedElo
+ 0.07 * graphTrust
+ 0.06 * collaboration
+ 0.05 * bidConfidence
+ 0.05 * priceAnomalySignal
- 0.05 * normalizedCost
- 0.04 * normalizedLatency
- 0.09 * uncertainty
```

This is the core reason SwarmDAQ feels different from a normal agent demo.

The swarm is selected by a market mechanism, not by vibes.

---

## Dashboard

The SwarmDAQ dashboard includes:

- mission input
- animated agent market
- bidding interface
- selected swarm panel with MarketMaker score breakdown and candidate reason strings
- live agent deliberation feed (objections, endorsements, revisions)
- agent reputation board
- W&B Weave-style trace timeline
- evaluation scorecards
- UCB / Bayesian / Elo math panels
- run-to-run improvement view
- shareable mission results pages (`/results/:missionId`)
- live agent leaderboard (`/leaderboard`) with BUY / HOLD / SELL / WATCH signals
- Agent Studio for deploying custom agents
- CopilotKit generative UI sidebar
- architecture page
- Redis Market Intelligence panel with event count, t-digest status, price percentiles, anomaly labels, p-values, and explanations
- demo page (mobile-responsive, iPhone 15 safe-area aware)

The UI is designed to make the market visible. You can watch agents compete, win, fail, recover, and improve.

---

## CopilotKit Generative UI

SwarmDAQ includes a full CopilotKit command center accessible via the chat popup in the bottom-right corner.

**Runtime endpoint:** `/api/copilotkit`

Uses `GoogleGenerativeAIAdapter` with `gemini-2.0-flash`. Key is resolved server-side from:

```
GEMINI_API_KEY || GOOGLE_GENERATIVE_AI_API_KEY || GOOGLE_API_KEY
```

**Frontend tools** are registered in `src/components/SwarmCopilot.tsx`. Each tool calls a SwarmDAQ API and renders a custom card:

| Tool | What it does |
|---|---|
| `runMission` | Runs a full agent market mission; renders `MissionResultCard` |
| `inspectAgents` | Fetches live agent scores with BUY/HOLD/SELL/WATCH labels |
| `explainMarketMaker` | Explains the composite score breakdown for the latest mission |
| `findWeakAgent` | Identifies the weakest agent by Bayesian mean + uncertainty |
| `rebalanceSwarm` | Suggests optimal swarm composition for quality/cost/speed/factuality |
| `compareRuns` | Side-by-side score and swarm comparison between two run numbers |
| `getMarketMemory` | Shows Redis-backed mission history and live feed events |
| `getTraces` | Fetches W&B Weave trace timeline |
| `replayMission` | Replays the event log for any past run |
| `getAgentHistory` | Shows an agent's reputation and performance history |
| `simulateAgentRemoval` | Predicts quality/factuality impact of removing an agent |
| `showReputationChanges` | Shows rep deltas from the most recent run |
| `explainRedisMemory` | Explains the Redis data schema and live memory contents |
| `resetMarket` | Resets demo state and agent scores to baseline |

**Example prompts:**

```
Run a mission for RocketRide
Find the weakest agent
Compare run 1 and run 4
Show Redis memory
Rebalance for factuality
Explain why agents were selected last run
Simulate removing SkepticAgent
```

**Security:** API key is server-side only. Never prefixed with `NEXT_PUBLIC_`. Never logged. Add to `.env.local` for local development and Vercel Environment Variables for production.

---

## Demo Flow

SwarmDAQ is built around a clear repeated-run demo.

### Run 1 — Failure Detected

ResearchAgent makes an unsupported market-size claim.

EvaluatorAgent catches it.

```text
Score: 74/100
ResearchAgent: -4 reputation
SourceVerifierAgent: +3 reputation
```

The market learns that research needs verification support.

---

### Run 2 — Market Improves

The MarketMaker pairs ResearchAgent with SourceVerifierAgent.

```text
Score: 91/100
Factuality: +17
Confidence: +12%
Swarm objective: 0.61 -> 0.84
```

The second run is better because the system learned from the first run.

---

### Run 3 — Over-Correction

The system over-rotates toward skepticism.

SkepticAgent improves factuality but weakens the pitch narrative.

```text
Score: 85/100
Factuality remains high
Narrative quality drops
```

SwarmDAQ shows not just improvement, but also regression detection.

---

### Run 4 — Calibrated Recovery

The market rebalances.

PitchAgent leads narrative. BuilderAgent supports synthesis. SkepticAgent returns to a calibrated support role.

```text
Score: 96/100
New peak across all dimensions
```

This is the core demo: a swarm that learns, over-corrects, detects regression, and recovers.

---

## What Makes This an Agentic System?

| Agent property | How SwarmDAQ implements it |
|---------------|-----------------------------|
| **Perceives** | Reads a mission and decomposes it into structured tasks |
| **Reasons** | Uses a MarketMaker score, auctions, UCB, Bayesian trust, and portfolio optimization |
| **Acts** | Selects and runs specialized agents |
| **Evaluates** | Scores outputs with EvaluatorAgent |
| **Remembers** | Stores reputation, task memory, Elo, and collaboration history |
| **Adapts** | Changes future routing based on previous performance |
| **Explains** | Shows why agents won, lost, improved, or were penalized |

---

## Project Structure

```text
swarmdaq/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/               # GET agent list + custom agent CRUD
│   │   │   ├── analytics/            # Analytics snapshot
│   │   │   ├── copilotkit/           # CopilotKit runtime endpoint
│   │   │   ├── history/              # Mission result + event log retrieval
│   │   │   ├── leaderboard/          # Live leaderboard endpoint
│   │   │   ├── market-feed/          # SSE market event stream
│   │   │   ├── market/intelligence/  # Market intelligence + Redis/Mem0 status
│   │   │   ├── mission/              # Mission execution + SSE stream
│   │   │   ├── reset-demo/           # Reset Redis to initial state
│   │   │   └── traces/               # W&B Weave trace retrieval
│   │   ├── architecture/             # Architecture explainer page
│   │   ├── benchmark/                # Benchmark comparison page
│   │   ├── demo/                     # Main demo terminal UI
│   │   ├── leaderboard/              # Live agent leaderboard page
│   │   ├── results/[missionId]/      # Shareable mission results page
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # Landing page
│   ├── components/
│   │   ├── copilot/                  # CopilotKit generative UI cards
│   │   └── SwarmCopilot.tsx          # CopilotKit sidebar
│   └── lib/
│       ├── __tests__/                # Vitest unit tests (74 tests)
│       │   ├── anomaly-contextualizer.test.ts
│       │   ├── api-intelligence.test.ts
│       │   ├── evaluation.test.ts
│       │   ├── market-streams.test.ts
│       │   ├── marketmaker.test.ts
│       │   ├── mem0.test.ts
│       │   ├── mode.test.ts
│       │   ├── price-anomaly.test.ts
│       │   ├── redis-client.test.ts
│       │   ├── reputation.test.ts
│       │   └── tdigest.test.ts
│       ├── market/
│       │   ├── anomaly-contextualizer.ts  # LLM anomaly explanation + fallback
│       │   ├── price-anomaly.ts           # p-value, severity, t-digest integration
│       │   └── scoring.ts                 # MarketMaker composite scoring
│       ├── math/
│       │   ├── agentMath.ts      # normalize, clamp01, weightedSum
│       │   ├── auction.ts        # Vickrey-inspired utility bidding
│       │   ├── bandits.ts        # UCB1 bandit routing
│       │   ├── contribution.ts   # Shapley-style contribution scoring
│       │   ├── graphTrust.ts     # PageRank-style trust graph
│       │   ├── portfolio.ts      # Markowitz-style swarm optimization
│       │   └── reputation.ts     # Bayesian Beta + Elo updates
│       ├── memory/
│       │   └── mem0.ts           # Mem0 agent memory (save/search, fallback when key missing)
│       ├── redis/
│       │   ├── client.ts         # Upstash Redis client, getRedisClient, safeRedis, rawRedisCommand, closeRedisClient
│       │   ├── index.ts          # Barrel: all redis helpers re-exported
│       │   ├── keys.ts           # Canonical KEY schema (swarmdaq:*)
│       │   ├── reputation.ts     # Agent hash reads/writes + leaderboard updates
│       │   ├── streams.ts        # Redis Streams: XADD, XREVRANGE, in-memory fallback
│       │   └── tdigest.ts        # T-Digest: native + redis-list + local-memory fallback
│       ├── redis.ts              # Canonical entrypoint → re-exports src/lib/redis/index
│       ├── tdigest.ts            # Backward-compat re-export of redis/tdigest
│       ├── agents.ts
│       ├── evaluation.ts         # LLM eval → content rubric fallback
│       ├── gemini.ts
│       ├── marketHistory.ts      # Mission event log
│       ├── memory.ts             # In-memory agent store (Redis-backed)
│       ├── messages.ts
│       ├── mode.ts               # ExecMode: LIVE | SEEDED_DEMO | FALLBACK
│       ├── orchestrator.ts       # Core mission + market loop
│       ├── providers.ts
│       ├── providers-config.ts
│       ├── trace.ts
│       └── types.ts
├── paper/                        # Research paper (LaTeX)
├── pitchdeck/
│   ├── slides.html               # HTML pitch deck source
│   └── generate.py               # Optional PPTX export
├── public/pitchdeck/
│   └── index.html                # Deployed deck at /pitchdeck
├── vitest.config.ts
├── next.config.ts
├── package.json
└── README.md
```

---

## Scientific Paper

The technical paper is available in `paper/main.tex`.
A compiled PDF is generated by GitHub Actions on every push.

---

## Quick Start

```bash
git clone https://github.com/VolodymyrLinuxovich/swarmdaq.git
cd swarmdaq
npm install
cp .env.example .env.local
```

Add your environment variables, or run without keys using deterministic fallbacks.

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Environment Variables

Create `.env.local` in the project root.

```env
# Gemini — required for LIVE mode
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here
GEMINI_API_KEY=your_gemini_key_here

# W&B Weave — optional, in-memory fallback if missing
WANDB_API_KEY=your_wandb_key_here
WANDB_PROJECT=swarmdaq
WANDB_ENTITY=your_wandb_entity_optional

# Redis — Upstash REST client (primary)
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Redis — Redis Cloud / native (alternative)
REDIS_URL=redis://:password@host:port
# REDIS_HOST=redis-xxxxx.cloud.redislabs.com
# REDIS_PASSWORD=your_password
# REDIS_PORT=6379

# Mem0 — optional, agent memory disabled if missing
MEM0_API_KEY=your_mem0_api_key

# Optional: force execution mode (LIVE | SEEDED_DEMO | FALLBACK)
# Default: LIVE if an API key is present, FALLBACK if not
SWARMDAQ_MODE=SEEDED_DEMO
```

Never commit real API keys. Add production secrets through Vercel environment variables.

The demo runs without keys via in-memory fallbacks. Redis Disabled and Mem0 Disabled states are shown in the dashboard.

---

## Redis / Mem0 Architecture

SwarmDAQ uses Redis for durable market state and Mem0 for agent memory that persists across missions.

**Redis Cloud (node-redis TCP)**

| Data structure | Key | Purpose |
|---|---|---|
| Stream | `swarmdaq:stream:market-events` | All market events (bids, selections, completions) |
| Stream | `swarmdaq:stream:evaluations` | Evaluation events with scores |
| Sorted Set | `swarmdaq:agent:leaderboard:reputation` | Reputation leaderboard |
| Sorted Set | `swarmdaq:agent:leaderboard:elo` | Elo leaderboard |
| Sorted Set | `swarmdaq:agent:leaderboard:factuality` | Factuality leaderboard |
| Hash | `swarmdaq:agent:{agentId}` | Agent state (reputation, elo, price, …) |
| T-Digest | `swarmdaq:tdigest:price:global` | Global clearing-price distribution |
| T-Digest | `swarmdaq:tdigest:price:task:{taskType}` | Per-task clearing-price distribution |
| T-Digest | `swarmdaq:tdigest:bid-price:task:{taskType}` | Per-task bid-price distribution |
| T-Digest | `swarmdaq:tdigest:latency:global` | Execution latency distribution |
| List | `swarmdaq:anomaly:{runId}` | Stored anomaly JSON (TTL 7 days) |

**Mem0 (REST API)**

Each save uses `user_id: "swarmdaq"`, `agent_id: agentId`, `run_id: runId`.

Memory types stored:
- agent strengths, failures, factuality mistakes
- price anomalies (underpriced, overpriced, spike, crash)
- tasks where high price was justified by quality
- evaluator explanations and judge-friendly summaries

---

## Live Mode vs Seeded Demo Mode

| Mode | Trigger | Behavior |
|---|---|---|
| `LIVE` | Gemini API key present | Real LLM calls, real market, real memory |
| `SEEDED_DEMO` | `SWARMDAQ_MODE=SEEDED_DEMO` | Deterministic outputs, reproducible demo |
| `FALLBACK` | No Gemini key | Pattern-matched responses, no LLM calls |

Redis and Mem0 work in all modes. In `SEEDED_DEMO`, market stats still accumulate in Redis.

---

## Redis Insight Inspection Guide

After running missions with Redis enabled, use **Redis Insight** to inspect state.

Connect to your Redis Cloud or Upstash instance and search for:

| Key pattern | Type | What you'll see |
|---|---|---|
| `swarmdaq:stream:market-events` | Stream | All bid, selection, completion, anomaly events |
| `swarmdaq:stream:evaluations` | Stream | Evaluation scores per task per agent |
| `swarmdaq:agent:leaderboard:reputation` | Sorted Set | Agents ranked by reputation score |
| `swarmdaq:agent:leaderboard:elo` | Sorted Set | Agents ranked by Elo rating |
| `swarmdaq:agent:leaderboard:factuality` | Sorted Set | Agents ranked by factuality |
| `swarmdaq:tdigest:clearing-price:global` | T-Digest | Global price distribution (p50/p90/p95/p99) |
| `swarmdaq:anomaly:{runId}` | List | JSON anomaly records for that run |
| `swarmdaq:agent:{agentId}` | Hash | Full agent state |

**Check T-Digest status** — The `/api/market/intelligence` endpoint reports:

```json
{
  "tdigestEnabled": true,
  "tdigestFallbackMode": "native"
}
```

If `tdigestFallbackMode` is `"redis-list"` or `"local-memory"`, your Redis tier does not support the T-Digest module. Anomaly percentiles still work via rolling-sample fallback.

**Anomaly keys appear** when `pValue < 0.10` (price anomaly detected). Inspect them to see agent name, price, historical p50/p90/p99, and the explanation summary.

---

## Run Locally

```bash
npm run dev
```

---

## Checks / Demo Commands

```bash
npm run lint
npm run typecheck
npm run build
npm test
```

Use the UI demo controls to run repeated missions and show how the market improves across runs.

---

## Deployment

Deploy with Vercel:

```bash
npm run build
vercel
vercel --prod
```

If you add or change environment variables, add them in Vercel first and then redeploy.

```bash
vercel env add GOOGLE_GENERATIVE_AI_API_KEY
vercel env add WANDB_API_KEY
vercel env add WANDB_PROJECT
vercel env add REDIS_URL
vercel --prod
```

---

## Demo Script

1. Open SwarmDAQ.
2. Enter a product or startup mission.
3. Run the first mission.
4. Show agents bidding on subtasks.
5. Show MarketMaker selecting the swarm.
6. Open the trace timeline.
7. Show EvaluatorAgent scoring the result.
8. Show reputation changes.
9. Run the mission again.
10. Show that SourceVerifierAgent gets promoted and factuality improves.
11. Run the regression demo.
12. Show over-correction.
13. Run the calibrated recovery demo.
14. Show the final score improvement and market learning loop.

---

## Hackathon Compliance

| Requirement | SwarmDAQ implementation |
|------------|--------------------------|
| **Agentic workflow** | PlannerAgent, MarketMakerAgent, specialized agents, EvaluatorAgent, and ReputationAgent form a full loop |
| **Tracing** | W&B Weave traces mission planning, bidding, routing, execution, evaluation, and reputation updates |
| **Evaluation** | EvaluatorAgent scores quality, factuality, usefulness, specificity, actionability, and collaboration |
| **Memory** | Redis stores agent reputation, task memory, leaderboard state, and mission history |
| **Self-improvement** | Later runs use updated reputation, UCB, Elo, task memory, and trust graph signals |
| **Mathematical depth** | UCB1, Bayesian Beta reputation, auctions, Elo, portfolio optimization, contribution scoring, and graph trust |
| **Live demo** | Vercel-hosted UI with animations, demo flow, and visible agent-market behavior |

---

## Execution Modes

SwarmDAQ has three clearly separated execution modes controlled by the `SWARMDAQ_MODE` environment variable.

| Mode | Trigger | Behavior |
|------|---------|----------|
| `LIVE` | Default when `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` is set | Real MarketMaker selection, LLM-based eval (JSON parse → Gemini scoring → rubric fallback), content-driven rep updates |
| `SEEDED_DEMO` | `SWARMDAQ_MODE=SEEDED_DEMO` | Scripted 4-run arc preserved for demo presentations. Deterministic scores, routing, and rep updates |
| `FALLBACK` | No API keys present | Pure MarketMaker selection and content rubric scoring; hardcoded outputs for each task type |

For hackathon demos, set `SWARMDAQ_MODE=SEEDED_DEMO` to guarantee the reliable 74→91→85→96 arc regardless of LLM nondeterminism.

---

## Known Limitations

- Redis is optional; without it, the app uses in-memory fallback behavior.
- W&B Weave tracing can fall back locally when credentials are unavailable.
- The auction mechanism is Vickrey-inspired, not a full production economic market.
- The Shapley contribution score uses an approximation for demo speed.
- The current demo focuses on startup/product missions, but the architecture can generalize to other task types.

---

## Roadmap

- Real-time W&B Weave dashboard links for every mission
- More agent types and user-created agents
- Public agent leaderboard
- Persistent user accounts
- Stronger Redis-backed memory schema
- Multi-mission analytics
- Agent marketplace API
- Team-based swarm competitions
- More advanced portfolio optimization
- Live cost and latency tracking
- External benchmark tasks for agent evaluation

---

## Final Pitch

SwarmDAQ is not another agent wrapper.

It is a performance exchange for AI agents: agents bid, compete, get evaluated, gain or lose reputation, and improve the next swarm.

**Hire better agents. Trace every run. Let the market learn.**
