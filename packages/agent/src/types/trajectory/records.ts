import type { TrajectoryRole } from "./shared";

export type TrajectoryRecordKind = "message" | "event";

export type TrajectoryEventCategory =
  | "turn"
  | "run"
  | "model"
  | "tool"
  | "provider"
  | "system";

export type TrajectoryJsonPrimitive = string | number | boolean | null;

export type TrajectoryJsonValue =
  | TrajectoryJsonPrimitive
  | TrajectoryJsonValue[]
  | { [key: string]: TrajectoryJsonValue };

export interface TrajectoryRecord {
  sessionId: string;
  createdAt: string;
  role: TrajectoryRole;
  text: string;
  kind?: TrajectoryRecordKind;
  event?: string;
  category?: TrajectoryEventCategory | string;
  runId?: string;
  roomId?: string;
  source?: string;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  metadata?: Record<string, TrajectoryJsonValue>;
}

export interface TrajectoryEventInput {
  sessionId?: string;
  createdAt?: string;
  role?: TrajectoryRole;
  text?: string;
  event: string;
  category: TrajectoryEventCategory | string;
  runId?: string;
  roomId?: string;
  source?: string;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  metadata?: Record<string, unknown>;
}

export interface TrajectoryEventRecord extends TrajectoryRecord {
  kind: "event";
  event: string;
  category: TrajectoryEventCategory | string;
}

export interface GatewayTraceLike {
  at: string;
  kind: string;
  platform: string;
  detail: string;
  sessionId?: string;
  userId?: string;
  roomId?: string;
}

export interface GatewayMessageLike {
  at: string;
  platform: string;
  userId?: string;
  roomId?: string;
  sessionId?: string;
  text?: string;
  detail?: string;
  status?: string;
}
