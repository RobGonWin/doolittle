import { describe, expect, it } from "bun:test";
import {
  evaluateRobloxOpenCloudMutation,
  readRobloxOpenCloudPolicy,
} from "./open-cloud-policy";

describe("Roblox Open Cloud policy", () => {
  it("defaults to fail-closed read-only dry-run behavior", () => {
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging,production",
    });

    expect(policy).toMatchObject({
      configured: false,
      authMode: "api-key",
      accessMode: "read-only",
      allowedEnvironments: ["staging", "production"],
      mutationsRequireApproval: true,
      allowProductionMutations: false,
      dryRun: true,
      enabledMutationCapabilities: [],
      configurationIssues: [],
    });
  });

  it("rejects mutations while access is read-only", () => {
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_OPEN_CLOUD_API_KEY: "secret-not-returned",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging,production",
      ROBLOX_ENABLE_PLACE_PUBLISHING: "true",
      ROBLOX_OPEN_CLOUD_DRY_RUN: "false",
    });

    expect(
      evaluateRobloxOpenCloudMutation(policy, {
        environment: "staging",
        capability: "place-publishing",
        approved: true,
      }),
    ).toEqual({
      allowed: false,
      reason: "Open Cloud is configured as read-only.",
    });
  });

  it("allows only an explicitly enabled, approved staging mutation", () => {
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_OPEN_CLOUD_API_KEY: "secret-not-returned",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "staging",
      ROBLOX_OPEN_CLOUD_ACCESS_MODE: "staging-write",
      ROBLOX_OPEN_CLOUD_MUTATIONS_REQUIRE_APPROVAL: "true",
      ROBLOX_OPEN_CLOUD_ALLOW_PRODUCTION_MUTATIONS: "false",
      ROBLOX_OPEN_CLOUD_DRY_RUN: "false",
      ROBLOX_ENABLE_PLACE_PUBLISHING: "true",
    });

    expect(
      evaluateRobloxOpenCloudMutation(policy, {
        environment: "staging",
        capability: "place-publishing",
        approved: true,
      }),
    ).toEqual({
      allowed: true,
      reason: "The mutation satisfies local policy.",
    });
    expect(
      evaluateRobloxOpenCloudMutation(policy, {
        environment: "production",
        capability: "place-publishing",
        approved: true,
      }).allowed,
    ).toBe(false);
  });

  it("fails closed for invalid modes and environments", () => {
    const policy = readRobloxOpenCloudPolicy({
      ROBLOX_OPEN_CLOUD_API_KEY: "secret-not-returned",
      ROBLOX_OPEN_CLOUD_AUTH_MODE: "oauth",
      ROBLOX_OPEN_CLOUD_ACCESS_MODE: "write-everywhere",
      ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS: "preview",
    });

    expect(policy.accessMode).toBe("read-only");
    expect(policy.allowedEnvironments).toEqual([]);
    expect(policy.configurationIssues).toHaveLength(3);
  });
});
