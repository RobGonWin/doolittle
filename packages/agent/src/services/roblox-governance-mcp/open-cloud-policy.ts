import { readRobloxOpenCloudCredentialRegistry } from "./credential-registry";

export type RobloxOpenCloudEnvironment = "staging" | "production";

export type RobloxOpenCloudMutationCapability =
  | "asset-mutations"
  | "commerce-mutations"
  | "place-publishing"
  | "user-restrictions"
  | "luau-execution"
  | "group-role-mutations"
  | "sponsored-campaign-mutations";

export interface RobloxOpenCloudPolicy {
  configured: boolean;
  authMode: "api-key";
  accessMode: "read-only" | "staging-write";
  allowedEnvironments: RobloxOpenCloudEnvironment[];
  mutationsRequireApproval: boolean;
  allowProductionMutations: boolean;
  dryRun: boolean;
  enabledMutationCapabilities: RobloxOpenCloudMutationCapability[];
  configurationIssues: string[];
}

type Environment = Record<string, string | undefined>;

const MUTATION_FLAGS: ReadonlyArray<
  readonly [RobloxOpenCloudMutationCapability, string]
> = [
  ["asset-mutations", "ROBLOX_ENABLE_ASSET_MUTATIONS"],
  ["commerce-mutations", "ROBLOX_ENABLE_COMMERCE_MUTATIONS"],
  ["place-publishing", "ROBLOX_ENABLE_PLACE_PUBLISHING"],
  ["user-restrictions", "ROBLOX_ENABLE_USER_RESTRICTIONS"],
  ["luau-execution", "ROBLOX_ENABLE_LUAU_EXECUTION"],
  ["group-role-mutations", "ROBLOX_ENABLE_GROUP_ROLE_MUTATIONS"],
  [
    "sponsored-campaign-mutations",
    "ROBLOX_ENABLE_SPONSORED_CAMPAIGN_MUTATIONS",
  ],
];

function isTrue(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function readAllowedEnvironments(
  value: string | undefined,
): RobloxOpenCloudEnvironment[] {
  const allowed = new Set<RobloxOpenCloudEnvironment>();
  for (const entry of value?.split(",") ?? []) {
    const normalized = entry.trim().toLowerCase();
    if (normalized === "staging" || normalized === "production") {
      allowed.add(normalized);
    }
  }
  return [...allowed];
}

export function readRobloxOpenCloudPolicy(
  env: Environment = process.env,
): RobloxOpenCloudPolicy {
  const configurationIssues: string[] = [];
  const credentialRegistry = readRobloxOpenCloudCredentialRegistry(env);
  const rawAuthMode = env.ROBLOX_OPEN_CLOUD_AUTH_MODE?.trim().toLowerCase();
  const rawAccessMode = env.ROBLOX_OPEN_CLOUD_ACCESS_MODE?.trim().toLowerCase();
  const allowedEnvironments = readAllowedEnvironments(
    env.ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS,
  );

  if (rawAuthMode && rawAuthMode !== "api-key") {
    configurationIssues.push(
      "The Open Cloud bridge supports API-key authentication only.",
    );
  }
  if (
    rawAccessMode &&
    rawAccessMode !== "read-only" &&
    rawAccessMode !== "staging-write"
  ) {
    configurationIssues.push("The Open Cloud access mode is not recognized.");
  }
  if (allowedEnvironments.length === 0) {
    configurationIssues.push("No valid Open Cloud environment is allowed.");
  }
  configurationIssues.push(...credentialRegistry.configurationIssues);

  const enabledMutationCapabilities = MUTATION_FLAGS.filter(([, variable]) =>
    isTrue(env[variable]),
  ).map(([capability]) => capability);

  return {
    configured: credentialRegistry.lanes.some((lane) => lane.configured),
    authMode: "api-key",
    accessMode:
      rawAccessMode === "staging-write" ? "staging-write" : "read-only",
    allowedEnvironments,
    mutationsRequireApproval:
      env.ROBLOX_OPEN_CLOUD_MUTATIONS_REQUIRE_APPROVAL === undefined ||
      isTrue(env.ROBLOX_OPEN_CLOUD_MUTATIONS_REQUIRE_APPROVAL),
    allowProductionMutations: isTrue(
      env.ROBLOX_OPEN_CLOUD_ALLOW_PRODUCTION_MUTATIONS,
    ),
    dryRun:
      env.ROBLOX_OPEN_CLOUD_DRY_RUN === undefined ||
      isTrue(env.ROBLOX_OPEN_CLOUD_DRY_RUN),
    enabledMutationCapabilities,
    configurationIssues,
  };
}

export interface RobloxOpenCloudMutationRequest {
  environment: RobloxOpenCloudEnvironment;
  capability: RobloxOpenCloudMutationCapability;
  approved: boolean;
}

export interface RobloxOpenCloudPolicyDecision {
  allowed: boolean;
  reason: string;
}

export function evaluateRobloxOpenCloudMutation(
  policy: RobloxOpenCloudPolicy,
  request: RobloxOpenCloudMutationRequest,
): RobloxOpenCloudPolicyDecision {
  if (!policy.configured) {
    return { allowed: false, reason: "Open Cloud is not configured." };
  }
  if (policy.configurationIssues.length > 0) {
    return { allowed: false, reason: "Open Cloud policy is invalid." };
  }
  if (!policy.allowedEnvironments.includes(request.environment)) {
    return { allowed: false, reason: "The target environment is not allowed." };
  }
  if (policy.accessMode === "read-only") {
    return { allowed: false, reason: "Open Cloud is configured as read-only." };
  }
  if (
    request.environment === "production" &&
    !policy.allowProductionMutations
  ) {
    return { allowed: false, reason: "Production mutations are disabled." };
  }
  if (!policy.enabledMutationCapabilities.includes(request.capability)) {
    return { allowed: false, reason: "The requested capability is disabled." };
  }
  if (policy.mutationsRequireApproval && !request.approved) {
    return {
      allowed: false,
      reason: "Explicit mutation approval is required.",
    };
  }
  if (policy.dryRun) {
    return { allowed: false, reason: "Open Cloud is in dry-run mode." };
  }
  return { allowed: true, reason: "The mutation satisfies local policy." };
}
