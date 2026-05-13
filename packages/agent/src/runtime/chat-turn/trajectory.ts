import type { AgentExecutionContext } from "@/runtime/chat";
import type { TrajectoryEventInput } from "@/types/trajectory";

type TrajectoryRecorder = {
  recordEvent(input: TrajectoryEventInput): unknown;
};

export function recordTrajectoryEvent(
  context: AgentExecutionContext,
  input: TrajectoryEventInput,
): void {
  try {
    const trajectories = (
      context.services as { trajectories?: TrajectoryRecorder }
    ).trajectories;
    trajectories?.recordEvent(input);
  } catch (error) {
    const logger = (context as { runtime?: AgentExecutionContext["runtime"] })
      .runtime?.logger;
    logger?.warn(
      { error, event: input.event, category: input.category },
      "Failed to record trajectory event",
    );
  }
}

export function elapsedMsSince(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
