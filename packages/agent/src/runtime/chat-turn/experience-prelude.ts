import type { AgentExecutionContext } from "@/runtime/chat";
import type { TurnState } from "./state";

type CharacterShape = {
  name?: string;
  bio?: unknown;
  lore?: unknown;
  adjectives?: unknown;
  style?: {
    all?: unknown;
    chat?: unknown;
    post?: unknown;
  };
};

function asTextList(value: unknown, limit = 5): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, limit);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function buildCharacterVoiceContext(context: AgentExecutionContext): string[] {
  const character = context.runtime.character as CharacterShape | undefined;
  const personality = (
    context.services as {
      personalities?: {
        getActive?: () => {
          name?: string;
          description?: string;
          systemAddendum?: string;
        };
      };
    }
  ).personalities?.getActive?.();
  const bio = asTextList(character?.bio, 4);
  const lore = asTextList(character?.lore, 3);
  const style = [
    ...asTextList(character?.style?.all, 4),
    ...asTextList(character?.style?.chat, 4),
    ...asTextList(character?.style?.post, 2),
  ].slice(0, 7);
  const adjectives = asTextList(character?.adjectives, 8);

  return [
    "Character voice:",
    `- name=${character?.name ?? "Doolittle"}`,
    ...bio.map((entry) => `- bio=${entry}`),
    ...lore.map((entry) => `- lore=${entry}`),
    ...(adjectives.length ? [`- adjectives=${adjectives.join(", ")}`] : []),
    ...style.map((entry) => `- style=${entry}`),
    personality
      ? `- activePersonality=${personality.name ?? "default"}: ${
          personality.description ?? ""
        } ${personality.systemAddendum ?? ""}`.trim()
      : undefined,
  ].filter((line): line is string => Boolean(line));
}

function buildRecentConversationContext(input: {
  context: AgentExecutionContext;
  sessionId: string;
  limit?: number;
}): string[] {
  try {
    const recent = input.context.services.sessions.recentBySession(
      input.sessionId,
      input.limit ?? 4,
    );
    const ordered = [...recent].reverse();
    if (!ordered.length) {
      return [];
    }
    return [
      "Recent conversation:",
      ...ordered.map(
        (message) => `- ${message.role}: ${message.text.slice(0, 220)}`,
      ),
    ];
  } catch {
    return [];
  }
}

function buildDurableMemoryContext(input: {
  context: AgentExecutionContext;
  userId: string;
  message: string;
}): string[] {
  try {
    const profile = input.context.services.userProfiles.get(input.userId);
    const memory = input.context.services.memory.summary("memory");
    const userMemory = input.context.services.memory.summary("user");
    const recall = input.context.services.userProfiles.recall(
      input.userId,
      input.message,
      5,
    );
    return [
      "Durable memory:",
      profile.displayName
        ? `- savedDisplayName=${profile.displayName}`
        : "- savedDisplayName=none",
      profile.aliases?.length
        ? `- aliases=${profile.aliases.slice(-3).join(", ")}`
        : null,
      profile.facts?.length
        ? `- facts=${profile.facts.slice(-3).join("; ")}`
        : null,
      profile.preferences?.length
        ? `- preferences=${profile.preferences.slice(-3).join("; ")}`
        : null,
      profile.explicitMemories?.length
        ? `- explicitMemories=${profile.explicitMemories.slice(-3).join("; ")}`
        : null,
      memory.preview.length
        ? `- sharedMemory=${memory.preview.slice(-3).join("; ")}`
        : `- sharedMemoryEntries=${memory.entries}`,
      userMemory.preview.length
        ? `- userMemory=${userMemory.preview.slice(-3).join("; ")}`
        : `- userMemoryEntries=${userMemory.entries}`,
      recall.length
        ? `- recall=${recall
            .map((hit) => `${hit.kind}: ${hit.value}`)
            .slice(0, 5)
            .join("; ")}`
        : null,
      "- Use saved memory when it materially improves continuity, and say when a requested fact is not saved.",
    ].filter((line): line is string => Boolean(line));
  } catch {
    return [];
  }
}

export function buildDoolittleExperiencePrelude(input: {
  context: AgentExecutionContext;
  turn: Pick<TurnState, "agentName" | "sessionId" | "localInteractive">;
  userId: string;
  message: string;
}): string {
  return [
    "DOOLITTLE EXPERIENCE CONTRACT",
    `- You are ${input.turn.agentName}: an ElizaOS-native agent with presence, memory, and operator-grade tool use.`,
    "- Sound like a vivid terminal-native teammate, not a generic assistant or product brochure.",
    "- Meet ordinary conversation as conversation. Avoid sterile AI disclaimers unless the user asks what you are.",
    "- For work that spans steps, keep a concise todo/checklist and update it as the situation changes.",
    "- Prefer concrete execution and truthful receipts over promises. Be explicit about what you ran, saw, changed, or inferred.",
    "- Use tools when the user asks for local work; use memory and session history when continuity matters.",
    "- Keep final answers human and compact: answer first, then mention verification or next work only when useful.",
    "",
    ...buildCharacterVoiceContext(input.context),
    "",
    ...buildRecentConversationContext({
      context: input.context,
      sessionId: input.turn.sessionId,
    }),
    "",
    ...buildDurableMemoryContext({
      context: input.context,
      userId: input.userId,
      message: input.message,
    }),
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .trim();
}
