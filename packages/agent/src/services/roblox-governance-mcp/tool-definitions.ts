import type { McpSecurityScheme, McpToolDescriptor } from "./types";

export const ROBLOX_GOVERNANCE_READ_SCOPE = "roblox.telemetry.read";

const readOnlyAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const noAuth: McpSecurityScheme[] = [{ type: "noauth" }];
const telemetryReadAuth: McpSecurityScheme[] = [
  { type: "oauth2", scopes: [ROBLOX_GOVERNANCE_READ_SCOPE] },
];

function descriptor(
  input: Omit<
    McpToolDescriptor,
    "annotations" | "securitySchemes" | "_meta"
  > & {
    securitySchemes: McpSecurityScheme[];
    invoking: string;
    invoked: string;
  },
): McpToolDescriptor {
  return {
    name: input.name,
    title: input.title,
    description: input.description,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    annotations: readOnlyAnnotations,
    securitySchemes: input.securitySchemes,
    _meta: {
      securitySchemes: input.securitySchemes,
      "openai/toolInvocation/invoking": input.invoking,
      "openai/toolInvocation/invoked": input.invoked,
    },
  };
}

const emptyInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

const findingSchema = {
  type: "object",
  additionalProperties: true,
  required: ["ruleId", "severity", "summary", "evidenceCount"],
  properties: {
    ruleId: { type: "string" },
    severity: { type: "string" },
    summary: { type: "string" },
    evidenceCount: { type: "number" },
  },
};

export const ROBLOX_GOVERNANCE_MCP_TOOLS: McpToolDescriptor[] = [
  descriptor({
    name: "get_project_association",
    title: "Get project association",
    description:
      "Use this when the user asks how the public Doolittle adapter is associated with the private 1v1 Edit Arena Roblox source and MCP endpoint.",
    securitySchemes: noAuth,
    invoking: "Reading association",
    invoked: "Association ready",
    inputSchema: emptyInputSchema,
    outputSchema: {
      type: "object",
      additionalProperties: true,
      required: [
        "relationship",
        "public_adapter",
        "private_game_source",
        "privacy",
      ],
      properties: {
        relationship: { type: "string" },
        public_adapter: { type: "object", additionalProperties: true },
        private_game_source: { type: "object", additionalProperties: true },
        mcp: { type: "object", additionalProperties: true },
        privacy: { type: "object", additionalProperties: true },
      },
    },
  }),
  descriptor({
    name: "get_telemetry_schema_evidence",
    title: "Get telemetry schema evidence",
    description:
      "Use this when the user asks for private-safe, reproducible telemetry schema evidence from the latest Roblox governance audit package.",
    securitySchemes: telemetryReadAuth,
    invoking: "Reading schema evidence",
    invoked: "Evidence ready",
    inputSchema: emptyInputSchema,
    outputSchema: {
      type: "object",
      additionalProperties: true,
      required: [
        "available",
        "schemaHash",
        "repository",
        "coverage",
        "findings",
        "association",
        "associationSource",
      ],
      properties: {
        available: { type: "boolean" },
        schemaHash: { type: ["string", "null"] },
        scannerVersion: { type: ["string", "null"] },
        collectedAt: { type: ["string", "null"] },
        repository: { type: "object", additionalProperties: true },
        coverage: { type: "object", additionalProperties: true },
        inventoryCounts: {
          type: "object",
          additionalProperties: { type: "number" },
        },
        findings: { type: "array", items: findingSchema },
        association: { type: "object", additionalProperties: true },
        associationSource: { type: "string" },
      },
    },
  }),
  descriptor({
    name: "get_event_lineage",
    title: "Get event lineage",
    description:
      "Use this when the user asks how 1v1 Edit Arena telemetry definitions connect to emitters, server validation, trust boundaries, and Roblox AnalyticsService calls.",
    securitySchemes: telemetryReadAuth,
    invoking: "Reading event lineage",
    invoked: "Lineage ready",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxRecords: {
          type: "integer",
          minimum: 1,
          maximum: 500,
          default: 100,
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: true,
      required: ["available", "schemaHash", "counts", "records"],
      properties: {
        available: { type: "boolean" },
        schemaHash: { type: ["string", "null"] },
        counts: { type: "object", additionalProperties: { type: "number" } },
        records: { type: "object", additionalProperties: true },
        notes: { type: "array", items: { type: "string" } },
      },
    },
  }),
  descriptor({
    name: "get_device_governance_profile",
    title: "Get device governance profile",
    description:
      "Use this when the user asks how 1v1 Edit Arena governance plans for current and emerging AR, XR, VR, wearable, biofeedback, spatial-computing, and IoT device ecosystems.",
    securitySchemes: noAuth,
    invoking: "Reading device profile",
    invoked: "Device profile ready",
    inputSchema: emptyInputSchema,
    outputSchema: {
      type: "object",
      additionalProperties: true,
      required: [
        "available",
        "purpose",
        "deviceCategories",
        "reviewControls",
        "privacyBoundary",
        "prohibitedAccess",
      ],
      properties: {
        available: { type: "boolean" },
        purpose: { type: "string" },
        deviceCategories: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        reviewControls: { type: "array", items: { type: "string" } },
        privacyBoundary: { type: "object", additionalProperties: true },
        prohibitedAccess: { type: "array", items: { type: "string" } },
        examples: { type: "array", items: { type: "string" } },
      },
    },
  }),
  descriptor({
    name: "get_live_telemetry_status",
    title: "Get live telemetry status",
    description:
      "Use this when the user asks whether official Roblox live telemetry aggregate access is configured for the governance bridge.",
    securitySchemes: telemetryReadAuth,
    invoking: "Checking live status",
    invoked: "Live status ready",
    inputSchema: emptyInputSchema,
    outputSchema: {
      type: "object",
      additionalProperties: true,
      required: [
        "configured",
        "provider",
        "officialInterfacesOnly",
        "coverageGaps",
      ],
      properties: {
        configured: { type: "boolean" },
        provider: { type: "string" },
        officialInterfacesOnly: { type: "boolean" },
        environments: { type: "array", items: { type: "string" } },
        coverageGaps: { type: "array", items: { type: "string" } },
      },
    },
  }),
  descriptor({
    name: "get_live_telemetry_aggregates",
    title: "Get live telemetry aggregates",
    description:
      "Use this when the user asks for aggregate-only live Roblox telemetry through official supported interfaces; never use it for raw player telemetry.",
    securitySchemes: telemetryReadAuth,
    invoking: "Checking aggregates",
    invoked: "Aggregate status ready",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["environment", "window", "metricSet"],
      properties: {
        environment: { type: "string", enum: ["staging", "production"] },
        window: {
          type: "string",
          minLength: 3,
          maxLength: 64,
          description:
            "A bounded aggregate window such as 24h or 2026-06-01/2026-06-07.",
        },
        metricSet: {
          type: "string",
          enum: ["all", "funnel", "custom", "economy", "progression"],
        },
      },
    },
    outputSchema: {
      type: "object",
      additionalProperties: true,
      required: ["available", "environment", "window", "metricSet", "reason"],
      properties: {
        available: { type: "boolean" },
        environment: { type: "string" },
        window: { type: "string" },
        metricSet: { type: "string" },
        reason: { type: "string" },
        aggregates: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
  }),
];

export function getRobloxGovernanceMcpTool(
  name: string,
): McpToolDescriptor | undefined {
  return ROBLOX_GOVERNANCE_MCP_TOOLS.find((tool) => tool.name === name);
}
