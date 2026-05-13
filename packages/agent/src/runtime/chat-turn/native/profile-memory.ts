import { ModelType } from "@elizaos/core";
import type { AgentExecutionContext, AgentTurnHooks } from "@/runtime/chat";
import type { TurnState } from "../state";
import { elapsedMsSince, recordTrajectoryEvent } from "../trajectory";
import {
  buildDirectInformationalPrompt,
  finalizeNativeShortcut,
  normalizeDirectInformationalResponse,
} from "./shortcuts";
import type { TurnPerfTrace } from "./types";

const NAME_UPDATE_PATTERN =
  /\b(?:update|set|save)\s+my\s+name\s+(?:to|as)\s+([^,.!?;\n]+)(?:[,.!?;]|$)/iu;

export function extractDisplayNameUpdate(message: string): string | undefined {
  const direct = message.match(NAME_UPDATE_PATTERN)?.[1]?.trim();
  if (direct) {
    return direct;
  }
  return message
    .match(/\bmy\s+name\s+is\s+([^,.!?;\n]+)(?:[,.!?;]|$)/iu)?.[1]
    ?.trim();
}

function asksForDoolittleIdentity(message: string): boolean {
  return /\b(?:yourself|your personality|personality|soul|interests?|likes?|who are you|what is your name|tell me about yourself)\b/iu.test(
    message,
  );
}

function asksForSoulIdentityWork(message: string): boolean {
  return (
    /\bsoul\.md\b/iu.test(message) ||
    /\b(?:form|build|create|write|give yourself|develop)\b[\s\S]{0,80}\bsoul\b/iu.test(
      message,
    ) ||
    /\b(?:true|real|actual)\s+(?:personality|soul|identity)\b/iu.test(message)
  );
}

function rememberDisplayName(input: {
  context: AgentExecutionContext;
  userId: string;
  displayName: string;
  source: string | undefined;
  sessionId: string;
  message: string;
}): void {
  input.context.services.userProfiles.observe(
    input.userId,
    `My name is ${input.displayName}.`,
    input.source,
    {
      source: input.source,
      channel: input.source,
      sessionId: input.sessionId,
      signal: input.message.slice(0, 160),
    },
  );
  try {
    input.context.services.memory.add(
      "user",
      `User display name: ${input.displayName}`,
    );
  } catch {
    // Profile storage is primary; memory mirroring is best-effort.
  }
}

export async function handleProfileMemoryModelTurn(input: {
  context: AgentExecutionContext;
  turn: TurnState;
  userId: string;
  message: string;
  scheduleProfileObservation: () => void;
  options?: AgentTurnHooks;
  perf: TurnPerfTrace;
  source: string | undefined;
}): Promise<string | undefined> {
  const displayName = extractDisplayNameUpdate(input.message);
  if (!input.turn.localInteractive || !displayName) {
    return undefined;
  }

  rememberDisplayName({
    context: input.context,
    userId: input.userId,
    displayName,
    source: input.source,
    sessionId: input.turn.sessionId,
    message: input.message,
  });

  const identityRequest = asksForDoolittleIdentity(input.message);
  const prompt = [
    buildDirectInformationalPrompt(input),
    "",
    "This turn has already applied a durable user profile update.",
    `- savedDisplayName=${displayName}`,
    identityRequest
      ? "- The user also asked about Doolittle's personality or soul. Answer from SOUL.md with warmth and specificity."
      : "- Acknowledge the saved name naturally.",
  ].join("\n");
  const settings = input.context.services.settings.get();
  const startedAt = performance.now();

  recordTrajectoryEvent(input.context, {
    category: "model",
    event: "model.request",
    sessionId: input.turn.sessionId,
    runId: input.turn.runId,
    roomId: String(input.turn.roomId),
    source: input.source ?? "cli",
    provider: settings.model.provider,
    model: settings.model.model,
    text: `[model:request] profile-memory-model ${settings.model.provider}/${settings.model.model}`,
    metadata: {
      path: "profile-memory-model",
      modelType: ModelType.TEXT_SMALL,
      prompt,
      promptChars: prompt.length,
      displayName,
      identityRequest,
      temperature: 0.45,
      maxTokens: identityRequest ? 260 : 120,
    },
  });

  try {
    const response = normalizeDirectInformationalResponse(
      await input.context.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        temperature: 0.45,
        maxTokens: identityRequest ? 260 : 120,
        stopSequences: ["\nUser:", "\nAssistant:", "\nDoolittle:"],
      }),
    );

    recordTrajectoryEvent(input.context, {
      category: "model",
      event: "model.response",
      sessionId: input.turn.sessionId,
      runId: input.turn.runId,
      roomId: String(input.turn.roomId),
      source: input.source ?? "cli",
      provider: settings.model.provider,
      model: settings.model.model,
      elapsedMs: elapsedMsSince(startedAt),
      text: `[model:response] ${response}`,
      metadata: {
        path: "profile-memory-model",
        response,
        responseChars: response.length,
        displayName,
      },
    });

    if (!response) {
      return undefined;
    }

    return finalizeNativeShortcut({
      context: input.context,
      turn: input.turn,
      response,
      scheduleProfileObservation: input.scheduleProfileObservation,
      options: input.options,
      channel: "model",
      perf: input.perf,
      path: "profile-memory-model",
      source: input.source,
      markPhase: "profile-memory-model",
    });
  } catch (error) {
    recordTrajectoryEvent(input.context, {
      category: "model",
      event: "model.error",
      sessionId: input.turn.sessionId,
      runId: input.turn.runId,
      roomId: String(input.turn.roomId),
      source: input.source ?? "cli",
      provider: settings.model.provider,
      model: settings.model.model,
      elapsedMs: elapsedMsSince(startedAt),
      text: "[model:error] profile-memory-model",
      metadata: {
        path: "profile-memory-model",
        error,
        displayName,
      },
    });
    input.context.runtime.logger?.warn(
      {
        error,
        roomId: input.turn.roomId,
        sessionId: input.turn.sessionId,
      },
      "Profile memory fast path failed; falling back to provider runtime",
    );
    return undefined;
  }
}

export async function handleSoulIdentityModelTurn(input: {
  context: AgentExecutionContext;
  turn: TurnState;
  userId: string;
  message: string;
  scheduleProfileObservation: () => void;
  options?: AgentTurnHooks;
  perf: TurnPerfTrace;
  source: string | undefined;
}): Promise<string | undefined> {
  if (!input.turn.localInteractive || !asksForSoulIdentityWork(input.message)) {
    return undefined;
  }

  const prompt = [
    buildDirectInformationalPrompt(input),
    "",
    "Soul identity task:",
    "- Treat this as a Doolittle identity/personality conversation, not a global character mutation.",
    "- Answer from the local SOUL.md when it exists.",
    "- Be warm, vivid, and specific. Avoid sterile disclaimers.",
    "- If the user asked for a soul file, acknowledge that SOUL.md is the local editable identity file.",
  ].join("\n");
  const settings = input.context.services.settings.get();
  const startedAt = performance.now();

  recordTrajectoryEvent(input.context, {
    category: "model",
    event: "model.request",
    sessionId: input.turn.sessionId,
    runId: input.turn.runId,
    roomId: String(input.turn.roomId),
    source: input.source ?? "cli",
    provider: settings.model.provider,
    model: settings.model.model,
    text: `[model:request] soul-identity-model ${settings.model.provider}/${settings.model.model}`,
    metadata: {
      path: "soul-identity-model",
      modelType: ModelType.TEXT_SMALL,
      prompt,
      promptChars: prompt.length,
      temperature: 0.55,
      maxTokens: 280,
    },
  });

  try {
    const response = normalizeDirectInformationalResponse(
      await input.context.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        temperature: 0.55,
        maxTokens: 280,
        stopSequences: ["\nUser:", "\nAssistant:", "\nDoolittle:"],
      }),
    );

    recordTrajectoryEvent(input.context, {
      category: "model",
      event: "model.response",
      sessionId: input.turn.sessionId,
      runId: input.turn.runId,
      roomId: String(input.turn.roomId),
      source: input.source ?? "cli",
      provider: settings.model.provider,
      model: settings.model.model,
      elapsedMs: elapsedMsSince(startedAt),
      text: `[model:response] ${response}`,
      metadata: {
        path: "soul-identity-model",
        response,
        responseChars: response.length,
      },
    });

    if (!response) {
      return undefined;
    }

    return finalizeNativeShortcut({
      context: input.context,
      turn: input.turn,
      response,
      scheduleProfileObservation: input.scheduleProfileObservation,
      options: input.options,
      channel: "model",
      perf: input.perf,
      path: "soul-identity-model",
      source: input.source,
      markPhase: "soul-identity-model",
    });
  } catch (error) {
    recordTrajectoryEvent(input.context, {
      category: "model",
      event: "model.error",
      sessionId: input.turn.sessionId,
      runId: input.turn.runId,
      roomId: String(input.turn.roomId),
      source: input.source ?? "cli",
      provider: settings.model.provider,
      model: settings.model.model,
      elapsedMs: elapsedMsSince(startedAt),
      text: "[model:error] soul-identity-model",
      metadata: {
        path: "soul-identity-model",
        error,
      },
    });
    input.context.runtime.logger?.warn(
      {
        error,
        roomId: input.turn.roomId,
        sessionId: input.turn.sessionId,
      },
      "Soul identity fast path failed; falling back to provider runtime",
    );
    return undefined;
  }
}
