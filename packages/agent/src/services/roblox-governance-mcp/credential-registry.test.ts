import { describe, expect, it } from "bun:test";
import {
  getRobloxOpenCloudCredentialLane,
  readRobloxOpenCloudCredentialRegistry,
  resolveRobloxOpenCloudCredential,
} from "./credential-registry";

describe("Roblox Open Cloud credential registry", () => {
  it("keeps every lane disabled unless explicitly enabled", () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_PROD_GOVERNANCE_API_KEY: "governance-secret",
      ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY: "asset-secret",
      ROBLOX_ASSET_ALLOWED_CREATOR_IDS: "32736689",
    });

    expect(registry.lanes.every((lane) => !lane.enabled)).toBe(true);
    expect(registry.allowedAssetCreatorIds).toEqual(["32736689"]);
    expect(
      getRobloxOpenCloudCredentialLane(registry, "group-asset-publisher"),
    ).toMatchObject({
      configured: true,
      enabled: false,
      requiredScopes: ["asset:read", "asset:write"],
    });
  });

  it("supports the legacy key only as a production governance fallback", () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_OPEN_CLOUD_API_KEY: "legacy-secret",
    });

    expect(
      getRobloxOpenCloudCredentialLane(registry, "prod-governance"),
    ).toMatchObject({ configured: true, usesLegacyFallback: true });
    expect(
      getRobloxOpenCloudCredentialLane(registry, "staging-place-publisher")
        .configured,
    ).toBe(false);
    expect(
      resolveRobloxOpenCloudCredential("prod-governance", {
        ROBLOX_OPEN_CLOUD_API_KEY: "legacy-secret",
      }),
    ).toBe("legacy-secret");
  });

  it("reports ambiguous legacy and dedicated governance configuration", () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_OPEN_CLOUD_API_KEY: "legacy-secret",
      ROBLOX_PROD_GOVERNANCE_API_KEY: "dedicated-secret",
    });

    expect(registry.configurationIssues).toHaveLength(1);
  });

  it("never places credential values in registry metadata", () => {
    const registry = readRobloxOpenCloudCredentialRegistry({
      ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY: "private-asset-secret",
    });

    expect(JSON.stringify(registry)).not.toContain("private-asset-secret");
  });
});
