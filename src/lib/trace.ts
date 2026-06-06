import { TraceEvent, LLMTrace, EvalTrace } from "./types";
import { v4 as uuidv4 } from "uuid";

const traceStore: TraceEvent[] = [];

let weaveInitialized = false;
let weaveInitPromise: Promise<void> | null = null;

async function initWeave(): Promise<void> {
  if (!process.env.WANDB_API_KEY) return;
  try {
    const weave = await import("weave");
    const project = process.env.WANDB_PROJECT ?? "swarmdaq";
    await weave.init(project);
    weaveInitialized = true;
    console.log(`[trace] W&B Weave initialized → project: ${project}`);
  } catch (err) {
    console.log("[trace] W&B Weave init failed, using in-memory traces:", String(err).slice(0, 80));
  }
}

function ensureWeaveInit(): Promise<void> {
  if (!weaveInitPromise) weaveInitPromise = initWeave();
  return weaveInitPromise;
}

// Call eagerly at module load
ensureWeaveInit();

export async function traceEvent(
  event: Omit<TraceEvent, "id" | "timestamp">
): Promise<TraceEvent> {
  const full: TraceEvent = { ...event, id: uuidv4(), timestamp: Date.now() };
  traceStore.push(full);
  return full;
}

export async function traceLLMCall(data: LLMTrace): Promise<void> {
  await traceEvent({ type: "llm_call", data: { ...data }, duration: data.latency });
}

export async function traceEval(data: EvalTrace): Promise<void> {
  await traceEvent({ type: "eval", data: { ...data } });
}

export function isWeaveEnabled(): boolean {
  return weaveInitialized;
}

export function getTraces(): TraceEvent[] {
  return [...traceStore];
}

export function getRecentTraces(n = 30): TraceEvent[] {
  return traceStore.slice(-n);
}

export function clearTraces(): void {
  traceStore.length = 0;
}
