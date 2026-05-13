export type TrajectoryRole = "user" | "assistant" | "system";

export type TrajectoryMode = "dataset" | "research" | "evaluation" | "rl";

export type TrajectoryGrade = "A" | "B" | "C" | "D" | "F";

export type TrajectoryProvider =
  | "openai"
  | "anthropic"
  | "ollama"
  | "offline"
  | "devin"
  | "codex"
  | "claude-code"
  | "elizacloud"
  | (string & {});

export interface TrajectoryFilters {
  sessionId?: string;
  role?: TrajectoryRole;
  includeEvents?: boolean;
  recordKind?: "message" | "event";
  event?: string;
  category?: string;
  runId?: string;
}
