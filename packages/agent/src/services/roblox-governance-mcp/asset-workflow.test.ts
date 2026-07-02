import { describe, expect, it } from "bun:test";
import {
  createRobloxAssetArtifactManifest,
  createRobloxAssetStagingEvidence,
  evaluateExactRobloxAssetPromotion,
  evaluateRobloxAssetMutation,
  pollRobloxAssetModerationStatus,
  runRobloxAssetStagingWorkflow,
  validateRobloxAssetPackage,
} from "./asset-workflow";
import { readRobloxOpenCloudCredentialRegistry } from "./credential-registry";
import { readRobloxOpenCloudPolicy } from "./open-cloud-policy";

const binaryModel = new TextEncoder().encode("<roblox!binary-model");

describe("Roblox asset workflow", () => {
  it("validates supported Roblox model packages", () => {
    expect(validateRobloxAssetPackage("arena.rbxm", binaryModel).valid).toBe(
      true,
    );
    expect(
      validateRobloxAssetPackage(
        "arena.rbxmx",
        new TextEncoder().encode('<?xml version="1.0"?><roblox version="4">'),
      ).valid,
    ).toBe(true);
    expect(validateRobloxAssetPackage("arena.rbxlx", binaryModel).valid).toBe(
      false,
    );
    expect(validateRobloxAssetPackage("../arena.rbxm", binaryModel).valid).toBe(
      false,
    );
  });

  it("builds a SHA-256 manifest without credential material", () => {
    const manifest = createRobloxAssetArtifactManifest({
      logicalName: "arena-model",
      fileName: "arena.rbxm",
      bytes: binaryModel,
      creatorId: "32736689",
      sourceCommit: "abc123",
    });

    expect(manifest.sha256).toHaveLength(64);
    expect(manifest).toMatchObject({
      creatorId: "32736689",
      extension: ".rbxm",
      mediaType: "model/x-rbxm",
    });
  });

  it("requires an enabled credential, allowlisted creator, and approval", () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY: "asset-secret",
      ROBLOX_GROUP_ASSET_PUBLISHER_ENABLED: "true",
      ROBLOX_ASSET_ALLOWED_CREATOR_IDS: "32736689",
    });
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_PROD_GOVERNANCE_API_KEY: "governance-secret",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging",
      ROBLOX_OPEN_CLOUD_ACCESS_MODE: "staging-write",
      ROBLOX_OPEN_CLOUD_DRY_RUN: "false",
      ROBLOX_ENABLE_ASSET_MUTATIONS: "true",
    });

    expect(
      evaluateRobloxAssetMutation({
        policy,
        registry,
        creatorId: "32736689",
        operation: "create",
        approved: true,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateRobloxAssetMutation({
        policy,
        registry,
        creatorId: "999",
        operation: "create",
        approved: true,
      }).allowed,
    ).toBe(false);
    expect(
      evaluateRobloxAssetMutation({
        policy,
        registry,
        creatorId: "32736689",
        operation: "create",
        approved: false,
      }).allowed,
    ).toBe(false);
  });

  it("permanently denies destructive and permission operations", () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY: "asset-secret",
      ROBLOX_GROUP_ASSET_PUBLISHER_ENABLED: "true",
      ROBLOX_ASSET_ALLOWED_CREATOR_IDS: "32736689",
    });
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_PROD_GOVERNANCE_API_KEY: "governance-secret",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging",
      ROBLOX_OPEN_CLOUD_ACCESS_MODE: "staging-write",
      ROBLOX_OPEN_CLOUD_DRY_RUN: "false",
      ROBLOX_ENABLE_ASSET_MUTATIONS: "true",
    });

    for (const operation of [
      "archive",
      "rollback",
      "delete",
      "permission-change",
    ] as const) {
      expect(
        evaluateRobloxAssetMutation({
          policy,
          registry,
          creatorId: "32736689",
          operation,
          approved: true,
        }).allowed,
      ).toBe(false);
    }
  });

  it("polls moderation with a bounded attempt count", async () => {
    const result = await pollRobloxAssetModerationStatus({
      maxAttempts: 3,
      readStatus: async (attempt) => ({
        status: attempt === 2 ? "approved" : "pending",
        assetId: attempt === 2 ? "123" : null,
      }),
    });

    expect(result).toEqual({ status: "approved", assetId: "123", attempts: 2 });
  });

  it("promotes only the exact approved staging asset and hash", () => {
    const artifact = createRobloxAssetArtifactManifest({
      logicalName: "arena-model",
      fileName: "arena.rbxm",
      bytes: binaryModel,
      creatorId: "32736689",
    });
    const evidence = createRobloxAssetStagingEvidence({
      artifact,
      assetId: "456",
      moderationStatus: "approved",
      stagingUniverseId: "8279974211",
      stagingPlaceId: "126501402641505",
      evidenceId: "asset-evidence-1",
    });

    expect(
      evaluateExactRobloxAssetPromotion({
        evidence,
        assetId: "456",
        sha256: artifact.sha256,
        approved: true,
      }).allowed,
    ).toBe(true);
    expect(
      evaluateExactRobloxAssetPromotion({
        evidence,
        assetId: "789",
        sha256: artifact.sha256,
        approved: true,
      }).allowed,
    ).toBe(false);
  });

  it("runs upload only after every staging gate passes", async () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY: "asset-secret",
      ROBLOX_GROUP_ASSET_PUBLISHER_ENABLED: "true",
      ROBLOX_ASSET_ALLOWED_CREATOR_IDS: "32736689",
    });
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_PROD_GOVERNANCE_API_KEY: "governance-secret",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging",
      ROBLOX_OPEN_CLOUD_ACCESS_MODE: "staging-write",
      ROBLOX_OPEN_CLOUD_DRY_RUN: "false",
      ROBLOX_ENABLE_ASSET_MUTATIONS: "true",
    });
    let uploadCalls = 0;

    const evidence = await runRobloxAssetStagingWorkflow({
      policy,
      registry,
      logicalName: "arena-model",
      fileName: "arena.rbxm",
      bytes: binaryModel,
      creatorId: "32736689",
      approved: true,
      stagingUniverseId: "8279974211",
      stagingPlaceId: "126501402641505",
      evidenceId: "asset-evidence-2",
      upload: async () => {
        uploadCalls += 1;
        return { operationId: "operation-1", assetId: null };
      },
      readModerationStatus: async () => ({
        status: "approved",
        assetId: "456",
      }),
    });

    expect(uploadCalls).toBe(1);
    expect(evidence.assetId).toBe("456");
  });

  it("does not call upload when the asset lane is dormant", async () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY: "asset-secret",
      ROBLOX_ASSET_ALLOWED_CREATOR_IDS: "32736689",
    });
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_PROD_GOVERNANCE_API_KEY: "governance-secret",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging",
      ROBLOX_OPEN_CLOUD_ACCESS_MODE: "staging-write",
      ROBLOX_OPEN_CLOUD_DRY_RUN: "false",
      ROBLOX_ENABLE_ASSET_MUTATIONS: "true",
    });
    let uploadCalls = 0;

    await expect(
      runRobloxAssetStagingWorkflow({
        policy,
        registry,
        logicalName: "arena-model",
        fileName: "arena.rbxm",
        bytes: binaryModel,
        creatorId: "32736689",
        approved: true,
        stagingUniverseId: "8279974211",
        stagingPlaceId: "126501402641505",
        evidenceId: "asset-evidence-3",
        upload: async () => {
          uploadCalls += 1;
          return { operationId: "operation-1", assetId: "456" };
        },
        readModerationStatus: async () => ({
          status: "approved",
          assetId: "456",
        }),
      }),
    ).rejects.toThrow("disabled");
    expect(uploadCalls).toBe(0);
  });
});
