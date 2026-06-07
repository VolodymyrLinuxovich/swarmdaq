# SwarmDAQ Video Demo Script

Target length: 3 to 4 minutes  
Recording style: screen recording with voiceover  
Goal: make SwarmDAQ feel like a real agent performance exchange, not just another multi-agent demo.

## One-Line Hook

SwarmDAQ is a market-based performance exchange for AI agents: agents bid on tasks, a MarketMaker selects the best swarm, every run is traced and evaluated, and Redis memory updates future routing.

## Recording Setup

Open these before recording:

- Live demo: https://swarmdaq.vercel.app
- GitHub repo: https://github.com/VolodymyrLinuxovich/swarmdaq
- Paper or deck if you want to show artifacts briefly
- W&B Weave page if credentials/traces are available

Use the demo mission:

```text
Build a launch plan for an AI product that helps hackathon teams turn research into a winning pitch.
```

## Full Demo Script

### 0:00-0:15 — Hook

Screen: show the SwarmDAQ home page or demo dashboard.

Voiceover:

> Everyone is building AI agents, but users still do not know which agents to trust, which agents failed, or why one agent was selected over another.
>
> SwarmDAQ solves that by turning AI agents into market participants. Agents bid on tasks, a MarketMaker routes work using performance math, outputs are traced and evaluated, and Redis stores reputation memory so the next swarm improves.

### 0:15-0:40 — Problem

Screen: show the demo interface, agent registry, or architecture page.

Voiceover:

> Most agent systems use static routing. A planner calls a researcher, then a writer, then maybe an evaluator. But the system usually forgets what happened.
>
> If an agent hallucinated, it may still get reused. If a verifier saved the output, that evidence is not always remembered. SwarmDAQ treats this as a market problem: agents need prices, trust scores, history, and visible performance.

### 0:40-1:15 — How SwarmDAQ Works

Screen: slowly scroll or show the architecture/dashboard.

Voiceover:

> Here is the loop. A user submits a mission. PlannerAgent decomposes it into tasks. Candidate agents submit bids with confidence, cost, latency, and expected utility.
>
> Then the MarketMaker scores each agent using skill match, Bayesian reputation, UCB exploration, bid utility, Elo rating, graph trust, cost, latency, and uncertainty.
>
> The selected swarm executes the mission. W&B Weave traces the run. EvaluatorAgent scores quality, factuality, usefulness, specificity, actionability, and collaboration. Finally, Redis updates the agent market state.

### 1:15-1:55 — Run The Demo

Screen: paste the mission into the demo and run it.

Voiceover:

> I will run a launch-plan mission. The system is not just generating text. It is selecting a swarm, recording bids, executing tasks, evaluating the result, and updating reputation.
>
> Notice the selected agents, the market decision log, the evaluation scores, and the reputation changes. This is the key idea: every output creates market evidence.

If the app shows deterministic fallback:

> The demo also has deterministic fallback behavior, so it remains stable even when external credentials are unavailable. In production mode, the same flow runs with Gemini execution and W&B tracing.

### 1:55-2:35 — Show Self-Improvement

Screen: run the demo multiple times or show the existing 4-run progression.

Voiceover:

> The strongest part is the repeated-run loop.
>
> On run one, the system detects a weak or unsupported claim. ResearchAgent is penalized, while SourceVerifierAgent gets promoted.
>
> On run two, factuality improves because the verifier is now more likely to be selected.
>
> On run three, the market over-corrects: skepticism becomes too dominant and hurts the narrative.
>
> On run four, the MarketMaker calibrates the swarm. PitchAgent, BuilderAgent, SkepticAgent, and SourceVerifierAgent are balanced, and the final output recovers.
>
> This is the product proof: evaluation changes memory, and memory changes routing.

### 2:35-3:05 — Redis Memory

Screen: show Market Memory panel, leaderboard, recent runs, or Copilot Redis explanation.

Voiceover:

> Redis is the memory layer behind the exchange. It stores agent reputation, Bayesian alpha and beta values, Elo ratings, task-specific success rates, mission history, event replay, market feed, and leaderboard state.
>
> That means SwarmDAQ does not reset intelligence after every run. It carries forward what it learned.
>
> The market feed and mission replay make the system auditable: we can see which agent was selected, what happened during the run, how the output was scored, and how reputation changed.

### 3:05-3:35 — Why This Matters

Screen: show leaderboard, market decision log, paper/deck briefly.

Voiceover:

> The bigger idea is that the agent economy needs a trust layer.
>
> SwarmDAQ is not just a chatbot and not just an orchestration framework. It is a performance exchange for agents. It decides which agents are worth hiring, tracks how they perform, and improves future routing from evidence.
>
> This makes agent routing explainable, evaluation visible, and swarm selection adaptive.

### 3:35-3:50 — Close

Screen: show repo, website, paper, and pitch deck.

Voiceover:

> SwarmDAQ is built with Next.js, TypeScript, Gemini, W&B Weave, Redis, and a mathematical MarketMaker.
>
> The live demo is at swarmdaq.vercel.app, and the code, technical paper, and pitch deck are in the GitHub repository.

## Short 90-Second Version

> SwarmDAQ is a market-based performance exchange for AI agents.
>
> Today, most agent systems route work statically. They do not clearly explain which agent was selected, which agent failed, or how past performance should affect the next run.
>
> SwarmDAQ treats agents like market participants. A user submits a mission, PlannerAgent decomposes it into tasks, agents bid with confidence, cost, latency, and utility, and a MarketMaker selects the swarm using skill match, Bayesian reputation, UCB exploration, Elo, graph trust, cost, latency, and uncertainty.
>
> The selected agents execute the mission with Gemini when credentials are available. W&B Weave traces the run. EvaluatorAgent scores the result. Redis stores the market memory: reputation, Bayesian alpha and beta, Elo ratings, task memory, mission replay, market feed, and leaderboards.
>
> The demo shows the self-improving loop. Run one detects a weak unsupported claim. Run two promotes SourceVerifierAgent and improves factuality. Run three shows an over-correction where skepticism hurts narrative quality. Run four rebalances the swarm and recovers.
>
> The point is simple: evaluation changes memory, and memory changes routing.
>
> SwarmDAQ makes agent orchestration auditable, adaptive, and market-based. It is the trust layer for deciding which AI agents are actually worth hiring.

## Screen Checklist

Show these moments in the final recording:

- Home or demo page with SwarmDAQ branding
- Mission input
- Agent registry or leaderboard
- MarketMaker decision log
- Selected swarm
- Evaluation scores
- Reputation deltas
- Market Memory / Redis panel
- Recent runs / mission replay
- W&B trace panel if available
- GitHub repo with paper and pitch deck

## Strong Phrases To Use

- "Agents should earn trust from evidence, not role labels."
- "Every run becomes market evidence."
- "Evaluation changes memory, and memory changes routing."
- "Redis is the durable memory layer for the agent exchange."
- "SwarmDAQ decides which agents are actually worth hiring."
- "This is not static orchestration. This is adaptive market-based routing."

## Avoid Saying

- Do not claim external benchmark results unless you have them on screen.
- Do not say this is a production financial market.
- Do not overclaim that the system guarantees truth.
- Say "prototype performance exchange" or "technical demo" when describing the current version.

