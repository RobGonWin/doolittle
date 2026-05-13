import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  TrajectoryEventInput,
  TrajectoryEventRecord,
  TrajectoryFilters,
  TrajectoryJsonValue,
} from "../../types/trajectory";

export const TRAJECTORY_EVENT_JOURNAL = "trajectory-events.jsonl";

const MAX_STRING_LENGTH = 12_000;
const MAX_ARRAY_LENGTH = 80;
const MAX_OBJECT_KEYS = 120;
const MAX_DEPTH = 6;

const SENSITIVE_KEY_PATTERN =
  /(?:api[_-]?key|auth|authorization|bearer|cookie|password|secret|access[_-]?token|refresh[_-]?token|id[_-]?token)\b/i;

export interface TrajectoryEventJournal {
  readonly path: string;
  append(input: TrajectoryEventInput): TrajectoryEventRecord;
  recent(limit: number, filters?: TrajectoryFilters): TrajectoryEventRecord[];
}

function truncate(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
}

function sanitizeJsonValue(value: unknown, depth = 0): TrajectoryJsonValue {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return truncate(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "undefined") {
    return null;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
      stack: value.stack ? truncate(value.stack) : null,
    };
  }
  if (depth >= MAX_DEPTH) {
    return "[max-depth]";
  }
  if (Array.isArray(value)) {
    const visible = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((item) => sanitizeJsonValue(item, depth + 1));
    if (value.length > MAX_ARRAY_LENGTH) {
      visible.push(`[truncated ${value.length - MAX_ARRAY_LENGTH} items]`);
    }
    return visible;
  }
  if (typeof value === "object") {
    const output: Record<string, TrajectoryJsonValue> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      MAX_OBJECT_KEYS,
    );
    for (const [key, entryValue] of entries) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeJsonValue(entryValue, depth + 1);
    }
    const totalKeys = Object.keys(value as Record<string, unknown>).length;
    if (totalKeys > MAX_OBJECT_KEYS) {
      output.__truncatedKeys = totalKeys - MAX_OBJECT_KEYS;
    }
    return output;
  }
  return String(value);
}

function formatEventText(input: TrajectoryEventInput): string {
  if (input.text?.trim()) {
    return truncate(input.text.trim());
  }
  const provider =
    input.provider && input.model
      ? ` ${input.provider}/${input.model}`
      : input.provider
        ? ` ${input.provider}`
        : "";
  const elapsed =
    typeof input.elapsedMs === "number"
      ? ` ${Math.round(input.elapsedMs)}ms`
      : "";
  return `[${input.category}:${input.event}]${provider}${elapsed}`.trim();
}

export function normalizeTrajectoryEventRecord(
  input: TrajectoryEventInput,
): TrajectoryEventRecord {
  return {
    kind: "event",
    sessionId: input.sessionId ?? "global",
    createdAt: input.createdAt ?? new Date().toISOString(),
    role: input.role ?? "system",
    text: formatEventText(input),
    event: input.event,
    category: input.category,
    runId: input.runId,
    roomId: input.roomId,
    source: input.source,
    provider: input.provider,
    model: input.model,
    elapsedMs:
      typeof input.elapsedMs === "number"
        ? Math.round(input.elapsedMs)
        : undefined,
    metadata: input.metadata
      ? (sanitizeJsonValue(input.metadata) as Record<
          string,
          TrajectoryJsonValue
        >)
      : undefined,
  };
}

function matchesFilters(
  record: TrajectoryEventRecord,
  filters?: TrajectoryFilters,
): boolean {
  if (!filters) {
    return true;
  }
  if (filters.sessionId && record.sessionId !== filters.sessionId) {
    return false;
  }
  if (filters.role && record.role !== filters.role) {
    return false;
  }
  if (filters.recordKind && filters.recordKind !== "event") {
    return false;
  }
  if (filters.event && record.event !== filters.event) {
    return false;
  }
  if (filters.category && record.category !== filters.category) {
    return false;
  }
  if (filters.runId && record.runId !== filters.runId) {
    return false;
  }
  return true;
}

export function createTrajectoryEventJournal(
  baseDir: string,
): TrajectoryEventJournal {
  mkdirSync(baseDir, { recursive: true });
  const path = join(baseDir, TRAJECTORY_EVENT_JOURNAL);
  return {
    path,
    append(input) {
      const record = normalizeTrajectoryEventRecord(input);
      appendFileSync(path, `${JSON.stringify(record)}\n`, "utf8");
      return record;
    },
    recent(limit, filters) {
      return readTrajectoryEventRecords(path, limit, filters);
    },
  };
}

export function readTrajectoryEventRecords(
  path: string,
  limit = 100,
  filters?: TrajectoryFilters,
): TrajectoryEventRecord[] {
  if (!existsSync(path)) {
    return [];
  }
  return readFileSync(path, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TrajectoryEventRecord)
    .filter((record) => matchesFilters(record, filters))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}
