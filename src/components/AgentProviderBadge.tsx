import { getAgentProviderTag } from "@/lib/agent-provider-tag";

export function AgentProviderBadge({ agentName }: { agentName: string }) {
  const tag = getAgentProviderTag(agentName);
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide border flex-shrink-0 ${tag.className}`}
    >
      {tag.label}
    </span>
  );
}
