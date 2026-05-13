import type { AgentExecutionContext } from "@/runtime/chat";
import { classifyTurnMessage } from "@/runtime/turn-classification/message";
import { deriveTurnExecutionPolicy } from "@/runtime/turn-classification/policy";
import type { ChatTurnRequest } from "@/types/runtime";
import {
  type PreparedTurnState,
  prepareTurnState,
  startTrackedTurn,
} from "../state";
import { recordTrajectoryEvent } from "../trajectory";
import type { NativeTurnSetup } from "./types";

export function prepareNativeTurnSetup(input: {
  input: ChatTurnRequest;
  effectiveInput: ChatTurnRequest;
  context: AgentExecutionContext;
  preparedTurn?: PreparedTurnState;
}): NativeTurnSetup {
  const { turn, scheduleProfileObservation } =
    input.preparedTurn ?? prepareTurnState(input.input, input.context);
  const derivedTurnPolicy = deriveTurnExecutionPolicy(
    input.effectiveInput.message,
    turn.settings.agent,
    {
      localInteractive: turn.localInteractive,
    },
  );
  const turnClassification = classifyTurnMessage(input.effectiveInput.message);
  startTrackedTurn(input.input, input.context, turn, derivedTurnPolicy);
  const modelSettings = turn.settings?.model ?? {};
  recordTrajectoryEvent(input.context, {
    category: "turn",
    event: "turn.classified",
    sessionId: turn.sessionId,
    runId: turn.runId,
    roomId: String(turn.roomId),
    source: input.input.source ?? "cli",
    provider: modelSettings.provider ?? "unknown",
    model: modelSettings.model ?? "unknown",
    text: `[turn:classified] profile=${
      turnClassification.shouldUseMultiStep ? "multi-step" : "single-step"
    }`,
    metadata: {
      originalMessage: input.input.message,
      effectiveMessage: input.effectiveInput.message,
      classification: turnClassification,
      derivedTurnPolicy,
    },
  });

  return {
    turn,
    scheduleProfileObservation,
    derivedTurnPolicy,
    turnClassification,
    settingsBefore: turn.settings,
  };
}
