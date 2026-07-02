export type RobloxOpenCloudCredentialLaneId =
  | "prod-governance"
  | "staging-place-publisher"
  | "staging-commerce"
  | "prod-commerce-read"
  | "prod-commerce-write"
  | "group-asset-publisher";

export interface RobloxOpenCloudCredentialLane {
  id: RobloxOpenCloudCredentialLaneId;
  secretEnvironmentVariable: string;
  enabledEnvironmentVariable: string;
  target: "production" | "staging" | "group";
  access: "read" | "write";
  requiredScopes: string[];
  configured: boolean;
  enabled: boolean;
  usesLegacyFallback: boolean;
}

export interface RobloxOpenCloudCredentialRegistry {
  lanes: RobloxOpenCloudCredentialLane[];
  allowedAssetCreatorIds: string[];
  configurationIssues: string[];
}

type Environment = Record<string, string | undefined>;

interface LaneDefinition {
  id: RobloxOpenCloudCredentialLaneId;
  secretEnvironmentVariable: string;
  enabledEnvironmentVariable: string;
  target: RobloxOpenCloudCredentialLane["target"];
  access: RobloxOpenCloudCredentialLane["access"];
  requiredScopes: string[];
}

const LANE_DEFINITIONS: LaneDefinition[] = [
  {
    id: "prod-governance",
    secretEnvironmentVariable: "ROBLOX_PROD_GOVERNANCE_API_KEY",
    enabledEnvironmentVariable: "ROBLOX_PROD_GOVERNANCE_ENABLED",
    target: "production",
    access: "read",
    requiredScopes: ["universe:read"],
  },
  {
    id: "staging-place-publisher",
    secretEnvironmentVariable: "ROBLOX_STAGING_PLACE_PUBLISHER_API_KEY",
    enabledEnvironmentVariable: "ROBLOX_STAGING_PLACE_PUBLISHER_ENABLED",
    target: "staging",
    access: "write",
    requiredScopes: ["universe-places:write"],
  },
  {
    id: "staging-commerce",
    secretEnvironmentVariable: "ROBLOX_STAGING_COMMERCE_API_KEY",
    enabledEnvironmentVariable: "ROBLOX_STAGING_COMMERCE_ENABLED",
    target: "staging",
    access: "write",
    requiredScopes: [
      "game-pass:read",
      "game-pass:write",
      "developer-product:read",
      "developer-product:write",
    ],
  },
  {
    id: "prod-commerce-read",
    secretEnvironmentVariable: "ROBLOX_PROD_COMMERCE_READ_API_KEY",
    enabledEnvironmentVariable: "ROBLOX_PROD_COMMERCE_READ_ENABLED",
    target: "production",
    access: "read",
    requiredScopes: ["game-pass:read", "developer-product:read"],
  },
  {
    id: "prod-commerce-write",
    secretEnvironmentVariable: "ROBLOX_PROD_COMMERCE_WRITE_API_KEY",
    enabledEnvironmentVariable: "ROBLOX_PROD_COMMERCE_WRITE_ENABLED",
    target: "production",
    access: "write",
    requiredScopes: [
      "game-pass:read",
      "game-pass:write",
      "developer-product:read",
      "developer-product:write",
    ],
  },
  {
    id: "group-asset-publisher",
    secretEnvironmentVariable: "ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY",
    enabledEnvironmentVariable: "ROBLOX_GROUP_ASSET_PUBLISHER_ENABLED",
    target: "group",
    access: "write",
    requiredScopes: ["asset:read", "asset:write"],
  },
];

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isConfigured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function readIdAllowlist(value: string | undefined): string[] {
  return [
    ...new Set(
      (value?.split(",") ?? [])
        .map((entry) => entry.trim())
        .filter((entry) => /^\d+$/.test(entry)),
    ),
  ];
}

export function readRobloxOpenCloudCredentialRegistry(
  env: Environment = process.env,
): RobloxOpenCloudCredentialRegistry {
  const legacyConfigured = isConfigured(env.ROBLOX_OPEN_CLOUD_API_KEY);
  const dedicatedGovernanceConfigured = isConfigured(
    env.ROBLOX_PROD_GOVERNANCE_API_KEY,
  );
  const configurationIssues: string[] = [];

  if (legacyConfigured && dedicatedGovernanceConfigured) {
    configurationIssues.push(
      "Both the legacy and dedicated production governance credentials are configured.",
    );
  }

  const lanes = LANE_DEFINITIONS.map((definition) => {
    const dedicatedConfigured = isConfigured(
      env[definition.secretEnvironmentVariable],
    );
    const usesLegacyFallback =
      definition.id === "prod-governance" &&
      !dedicatedConfigured &&
      legacyConfigured;
    return {
      ...definition,
      configured: dedicatedConfigured || usesLegacyFallback,
      enabled: isTrue(env[definition.enabledEnvironmentVariable]),
      usesLegacyFallback,
    };
  });

  return {
    lanes,
    allowedAssetCreatorIds: readIdAllowlist(
      env.ROBLOX_ASSET_ALLOWED_CREATOR_IDS,
    ),
    configurationIssues,
  };
}

export function getRobloxOpenCloudCredentialLane(
  registry: RobloxOpenCloudCredentialRegistry,
  id: RobloxOpenCloudCredentialLaneId,
): RobloxOpenCloudCredentialLane {
  const lane = registry.lanes.find((candidate) => candidate.id === id);
  if (!lane) {
    throw new Error(`Unknown Roblox Open Cloud credential lane: ${id}`);
  }
  return lane;
}

export function resolveRobloxOpenCloudCredential(
  id: RobloxOpenCloudCredentialLaneId,
  env: Environment = process.env,
): string | undefined {
  const definition = LANE_DEFINITIONS.find((candidate) => candidate.id === id);
  if (!definition) return undefined;

  const dedicated = env[definition.secretEnvironmentVariable]?.trim();
  if (dedicated) return dedicated;
  if (id === "prod-governance") {
    return env.ROBLOX_OPEN_CLOUD_API_KEY?.trim() || undefined;
  }
  return undefined;
}
