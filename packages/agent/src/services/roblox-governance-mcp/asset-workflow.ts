import { createHash } from "node:crypto";
import {
  getRobloxOpenCloudCredentialLane,
  type RobloxOpenCloudCredentialRegistry,
} from "./credential-registry";
import {
  evaluateRobloxOpenCloudMutation,
  type RobloxOpenCloudPolicy,
  type RobloxOpenCloudPolicyDecision,
} from "./open-cloud-policy";

export type RobloxAssetPackageExtension = ".rbxm" | ".rbxmx";
export type RobloxAssetModerationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "failed";

export interface RobloxAssetPackageValidation {
  valid: boolean;
  extension: RobloxAssetPackageExtension | null;
  mediaType: "model/x-rbxm" | null;
  errors: string[];
}

function readExtension(fileName: string): RobloxAssetPackageExtension | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".rbxm")) return ".rbxm";
  if (normalized.endsWith(".rbxmx")) return ".rbxmx";
  return null;
}

function startsWithAscii(bytes: Uint8Array, expected: string): boolean {
  if (bytes.length < expected.length) return false;
  return [...expected].every(
    (character, index) => bytes[index] === character.charCodeAt(0),
  );
}

export function validateRobloxAssetPackage(
  fileName: string,
  bytes: Uint8Array,
): RobloxAssetPackageValidation {
  const errors: string[] = [];
  const extension = readExtension(fileName);

  if (fileName.includes("/") || fileName.includes("\\")) {
    errors.push("Asset package names must not contain path separators.");
  }
  if (!extension) {
    errors.push("Only .rbxm and .rbxmx model packages are allowed.");
  }
  if (bytes.length === 0) {
    errors.push("Asset package content is empty.");
  } else if (extension === ".rbxm" && !startsWithAscii(bytes, "<roblox!")) {
    errors.push("The .rbxm package does not have a Roblox binary header.");
  } else if (extension === ".rbxmx") {
    const prefix = new TextDecoder().decode(bytes.slice(0, 1024));
    if (!prefix.includes("<roblox")) {
      errors.push("The .rbxmx package does not contain a Roblox XML root.");
    }
  }

  return {
    valid: errors.length === 0,
    extension,
    mediaType: extension ? "model/x-rbxm" : null,
    errors,
  };
}

export interface RobloxAssetArtifactManifest {
  schemaVersion: "1.0";
  logicalName: string;
  fileName: string;
  extension: RobloxAssetPackageExtension;
  mediaType: "model/x-rbxm";
  sizeBytes: number;
  sha256: string;
  creatorId: string;
  sourceCommit: string | null;
}

export function createRobloxAssetArtifactManifest(input: {
  logicalName: string;
  fileName: string;
  bytes: Uint8Array;
  creatorId: string;
  sourceCommit?: string | null;
}): RobloxAssetArtifactManifest {
  const validation = validateRobloxAssetPackage(input.fileName, input.bytes);
  if (!validation.valid || !validation.extension || !validation.mediaType) {
    throw new Error(validation.errors.join(" "));
  }
  if (!/^\d+$/.test(input.creatorId)) {
    throw new Error("The Roblox asset creator ID must be numeric.");
  }
  const logicalName = input.logicalName.trim();
  if (!logicalName) {
    throw new Error("The Roblox asset logical name is required.");
  }

  return {
    schemaVersion: "1.0",
    logicalName,
    fileName: input.fileName,
    extension: validation.extension,
    mediaType: validation.mediaType,
    sizeBytes: input.bytes.length,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
    creatorId: input.creatorId,
    sourceCommit: input.sourceCommit?.trim() || null,
  };
}

export type RobloxAssetMutationOperation =
  | "create"
  | "update"
  | "archive"
  | "rollback"
  | "delete"
  | "permission-change";

const PERMANENTLY_DENIED_OPERATIONS = new Set<RobloxAssetMutationOperation>([
  "archive",
  "rollback",
  "delete",
  "permission-change",
]);

export function evaluateRobloxAssetMutation(input: {
  policy: RobloxOpenCloudPolicy;
  registry: RobloxOpenCloudCredentialRegistry;
  creatorId: string;
  operation: RobloxAssetMutationOperation;
  approved: boolean;
}): RobloxOpenCloudPolicyDecision {
  const lane = getRobloxOpenCloudCredentialLane(
    input.registry,
    "group-asset-publisher",
  );
  if (!lane.configured) {
    return {
      allowed: false,
      reason: "The asset credential is not configured.",
    };
  }
  if (!lane.enabled) {
    return { allowed: false, reason: "The asset credential lane is disabled." };
  }
  if (!input.registry.allowedAssetCreatorIds.includes(input.creatorId)) {
    return { allowed: false, reason: "The asset creator is not allowlisted." };
  }
  if (PERMANENTLY_DENIED_OPERATIONS.has(input.operation)) {
    return {
      allowed: false,
      reason:
        "Destructive asset lifecycle and permission operations are denied.",
    };
  }
  return evaluateRobloxOpenCloudMutation(input.policy, {
    environment: "staging",
    capability: "asset-mutations",
    approved: input.approved,
  });
}

export interface RobloxAssetModerationResult {
  status: RobloxAssetModerationStatus;
  assetId: string | null;
  attempts: number;
  detail?: string;
}

export async function pollRobloxAssetModerationStatus(input: {
  readStatus: (
    attempt: number,
  ) => Promise<Omit<RobloxAssetModerationResult, "attempts">>;
  wait?: (attempt: number) => Promise<void>;
  maxAttempts?: number;
}): Promise<RobloxAssetModerationResult> {
  const maxAttempts = input.maxAttempts ?? 10;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) {
    throw new Error("Moderation polling attempts must be between 1 and 100.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await input.readStatus(attempt);
    if (result.status !== "pending" || attempt === maxAttempts) {
      return { ...result, attempts: attempt };
    }
    await input.wait?.(attempt);
  }
  throw new Error("Moderation polling ended unexpectedly.");
}

export interface RobloxAssetStagingEvidence {
  schemaVersion: "1.0";
  artifact: RobloxAssetArtifactManifest;
  assetId: string;
  moderationStatus: RobloxAssetModerationStatus;
  stagingUniverseId: string;
  stagingPlaceId: string;
  evidenceId: string;
}

export function createRobloxAssetStagingEvidence(input: {
  artifact: RobloxAssetArtifactManifest;
  assetId: string;
  moderationStatus: RobloxAssetModerationStatus;
  stagingUniverseId: string;
  stagingPlaceId: string;
  evidenceId: string;
}): RobloxAssetStagingEvidence {
  for (const [name, value] of [
    ["asset", input.assetId],
    ["staging universe", input.stagingUniverseId],
    ["staging place", input.stagingPlaceId],
  ] as const) {
    if (!/^\d+$/.test(value)) {
      throw new Error(`The ${name} ID must be numeric.`);
    }
  }
  if (!input.evidenceId.trim()) {
    throw new Error("A staging evidence ID is required.");
  }

  return {
    schemaVersion: "1.0",
    artifact: input.artifact,
    assetId: input.assetId,
    moderationStatus: input.moderationStatus,
    stagingUniverseId: input.stagingUniverseId,
    stagingPlaceId: input.stagingPlaceId,
    evidenceId: input.evidenceId,
  };
}

export function evaluateExactRobloxAssetPromotion(input: {
  evidence: RobloxAssetStagingEvidence;
  assetId: string;
  sha256: string;
  approved: boolean;
}): RobloxOpenCloudPolicyDecision {
  if (!input.approved) {
    return { allowed: false, reason: "Production promotion is not approved." };
  }
  if (input.evidence.moderationStatus !== "approved") {
    return { allowed: false, reason: "The staging asset is not approved." };
  }
  if (
    input.assetId !== input.evidence.assetId ||
    input.sha256 !== input.evidence.artifact.sha256
  ) {
    return {
      allowed: false,
      reason: "Production promotion must use the exact staged asset and hash.",
    };
  }
  return {
    allowed: true,
    reason: "The exact approved staging asset may be referenced in production.",
  };
}

export interface RobloxAssetUploadReceipt {
  operationId: string;
  assetId: string | null;
}

export async function runRobloxAssetStagingWorkflow(input: {
  policy: RobloxOpenCloudPolicy;
  registry: RobloxOpenCloudCredentialRegistry;
  logicalName: string;
  fileName: string;
  bytes: Uint8Array;
  creatorId: string;
  sourceCommit?: string | null;
  approved: boolean;
  stagingUniverseId: string;
  stagingPlaceId: string;
  evidenceId: string;
  upload: (
    artifact: RobloxAssetArtifactManifest,
    bytes: Uint8Array,
  ) => Promise<RobloxAssetUploadReceipt>;
  readModerationStatus: (
    receipt: RobloxAssetUploadReceipt,
    attempt: number,
  ) => Promise<Omit<RobloxAssetModerationResult, "attempts">>;
  wait?: (attempt: number) => Promise<void>;
  maxModerationAttempts?: number;
}): Promise<RobloxAssetStagingEvidence> {
  const artifact = createRobloxAssetArtifactManifest({
    logicalName: input.logicalName,
    fileName: input.fileName,
    bytes: input.bytes,
    creatorId: input.creatorId,
    sourceCommit: input.sourceCommit,
  });
  const decision = evaluateRobloxAssetMutation({
    policy: input.policy,
    registry: input.registry,
    creatorId: input.creatorId,
    operation: "create",
    approved: input.approved,
  });
  if (!decision.allowed) {
    throw new Error(decision.reason);
  }

  const receipt = await input.upload(artifact, input.bytes);
  if (!receipt.operationId.trim()) {
    throw new Error("The Roblox asset upload did not return an operation ID.");
  }
  const moderation = await pollRobloxAssetModerationStatus({
    maxAttempts: input.maxModerationAttempts,
    wait: input.wait,
    readStatus: (attempt) => input.readModerationStatus(receipt, attempt),
  });
  const assetId = moderation.assetId ?? receipt.assetId;
  if (!assetId) {
    throw new Error("The Roblox asset workflow did not return an asset ID.");
  }

  return createRobloxAssetStagingEvidence({
    artifact,
    assetId,
    moderationStatus: moderation.status,
    stagingUniverseId: input.stagingUniverseId,
    stagingPlaceId: input.stagingPlaceId,
    evidenceId: input.evidenceId,
  });
}
