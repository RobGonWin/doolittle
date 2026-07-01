import {
  countInventory,
  readLatestEvidencePackage,
  readPublicAssociation,
  resolveEvidenceAssociation,
  sanitizeCoverage,
  sanitizeRepository,
} from "./evidence";
import { readRobloxOpenCloudPolicy } from "./open-cloud-policy";
import {
  getRobloxGovernanceMcpTool,
  ROBLOX_GOVERNANCE_MCP_TOOLS,
  ROBLOX_GOVERNANCE_READ_SCOPE,
} from "./tool-definitions";
import type { JsonRpcRequest, McpToolResult } from "./types";

const SERVER_INFO = {
  name: "doolittle-roblox-governance",
  version: "0.1.0",
};

const SERVER_INSTRUCTIONS =
  "Expose private-safe Roblox governance evidence only. Never return private source snippets, player-level telemetry, usernames, UserIds, chat, raw custom fields, tokens, keys, cookies, or Creator Dashboard scraped data.";

function contentFromStructured(structuredContent: Record<string, unknown>) {
  return [{ type: "text" as const, text: JSON.stringify(structuredContent) }];
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function isNoAuthTool(name: string): boolean {
  const tool = getRobloxGovernanceMcpTool(name);
  return Boolean(
    tool?.securitySchemes.some((scheme) => scheme.type === "noauth"),
  );
}

function authorizeToolCall(
  name: string,
  request: Request,
): McpToolResult | null {
  if (isNoAuthTool(name)) {
    return null;
  }

  const expected =
    process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN?.trim();
  const actual = getBearerToken(request);
  if (expected && actual === expected) {
    return null;
  }

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "OAuth authorization is required to read Roblox telemetry governance evidence.",
      },
    ],
    _meta: {
      "mcp/www_authenticate": `Bearer realm="Doolittle Roblox Governance", scope="${ROBLOX_GOVERNANCE_READ_SCOPE}"`,
    },
  };
}

function getNumberInput(
  input: Record<string, unknown>,
  key: string,
  fallback: number,
) {
  const value = Number(input[key]);
  return Number.isFinite(value) ? value : fallback;
}

function boundedRecords(records: unknown, maxRecords: number): unknown[] {
  if (!Array.isArray(records)) {
    return [];
  }
  return records.slice(0, Math.max(1, Math.min(maxRecords, 500)));
}

function getDeviceGovernanceProfile(): Record<string, unknown> {
  return {
    available: true,
    purpose:
      "Plan safe, auditable Roblox experience integrations for current and emerging device ecosystems without granting device access or collecting raw device signals.",
    deviceCategories: [
      {
        category: "AR and smart glasses",
        governanceUse:
          "Review display, input, accessibility, and consent boundaries before any device-specific integration is considered.",
      },
      {
        category: "XR, VR, and spatial-computing headsets",
        governanceUse:
          "Map interaction, locomotion, comfort, telemetry, and playtesting assumptions to Roblox experience requirements.",
      },
      {
        category: "Wearables and heart-rate sensors",
        governanceUse:
          "Define aggregate-only telemetry expectations and consent gates before any health-adjacent signal is used.",
      },
      {
        category: "EEG and biofeedback devices",
        governanceUse:
          "Require explicit opt-in design, minimization, and review before considering attention, relaxation, or other inferred signals.",
      },
      {
        category: "IoT and future connected hardware",
        governanceUse:
          "Classify capabilities, data flows, and prohibited actions before interoperability work begins.",
      },
    ],
    reviewControls: [
      "Read-only governance profile; this tool does not connect to devices or Roblox Studio.",
      "No raw biometric, health, motion, camera, microphone, location, or sensor streams are requested or returned.",
      "Device-related capabilities must be intentionally enabled, documented, user-consented, and reviewed before implementation.",
      "Telemetry review remains aggregate, redacted, and scoped to official Roblox-supported interfaces.",
      "Private Roblox source, player identifiers, usernames, chat, cookies, tokens, and raw custom telemetry fields remain outside the public app boundary.",
    ],
    privacyBoundary: {
      deviceAccessGranted: false,
      rawSensorDataCollected: false,
      biometricDataCollected: false,
      playerLevelTelemetryReturned: false,
      privateSourceCodeReturned: false,
      robloxStudioControlEnabled: false,
      creatorDashboardScrapingEnabled: false,
    },
    prohibitedAccess: [
      "Roblox session-cookie material",
      "Creator Dashboard scraping",
      "Raw player-level telemetry exports",
      "Unprocessed biometric or health-device signals",
      "Unreviewed device control, input simulation, or automation",
      "Roblox Studio script edits, Luau execution, or playtest control through the public ChatGPT app",
    ],
    examples: [
      "Muse S Athena",
      "BrainAccess HALO",
      "Polar H10",
      "XREAL One Pro",
      "VITURE Luma Ultra",
      "Even Realities glasses",
      "Android XR and Samsung Galaxy XR",
      "Apple Vision Pro and visionOS devices",
      "Future smart-glasses and spatial-computing platforms",
    ],
  };
}

async function callTool(
  name: string,
  input: Record<string, unknown>,
  request: Request,
): Promise<McpToolResult> {
  const unauthorized = authorizeToolCall(name, request);
  if (unauthorized) {
    return unauthorized;
  }

  if (name === "get_project_association") {
    const structuredContent = readPublicAssociation();
    return {
      structuredContent,
      content: contentFromStructured(structuredContent),
    };
  }

  if (name === "get_telemetry_schema_evidence") {
    const evidence = readLatestEvidencePackage();
    if (!evidence.available || !evidence.repositoryScan) {
      const structuredContent = {
        available: false,
        schemaHash: null,
        scannerVersion: null,
        collectedAt: null,
        repository: {},
        coverage: {},
        inventoryCounts: {},
        findings: [],
        association: readPublicAssociation(),
        associationSource: "public-association-fallback",
        reason: "No generated Roblox governance evidence package was found.",
      };
      return {
        structuredContent,
        content: contentFromStructured(structuredContent),
      };
    }

    const scan = evidence.repositoryScan;
    const association = resolveEvidenceAssociation(
      evidence.manifest,
      evidence.repositoryScan,
    );
    const structuredContent = {
      available: true,
      schemaHash: scan.schemaHash ?? null,
      scannerVersion: scan.scannerVersion ?? null,
      collectedAt: scan.collectedAt ?? null,
      repository: sanitizeRepository(scan.repository),
      coverage: sanitizeCoverage(scan.coverage),
      inventoryCounts: countInventory(scan.inventory),
      findings: scan.findings ?? [],
      redactionAudit: scan.redactionAudit ?? {},
      association: association.value,
      associationSource: association.source,
    };
    return {
      structuredContent,
      content: contentFromStructured(structuredContent),
    };
  }

  if (name === "get_event_lineage") {
    const evidence = readLatestEvidencePackage();
    if (!evidence.available || !evidence.eventLineage) {
      const structuredContent = {
        available: false,
        schemaHash: null,
        counts: {},
        records: {},
        notes: [
          "No generated Roblox governance event-lineage package was found.",
        ],
      };
      return {
        structuredContent,
        content: contentFromStructured(structuredContent),
      };
    }

    const maxRecords = getNumberInput(input, "maxRecords", 100);
    const lineage = evidence.eventLineage;
    const recordKeys = [
      "registryReferences",
      "emitters",
      "serverValidationGates",
      "trustBoundaries",
      "onboardingRouting",
      "robloxAnalyticsCalls",
    ];
    const records = Object.fromEntries(
      recordKeys.map((key) => [key, boundedRecords(lineage[key], maxRecords)]),
    );
    const counts = Object.fromEntries(
      recordKeys.map((key) => [
        key,
        Array.isArray(lineage[key]) ? lineage[key].length : 0,
      ]),
    );
    const structuredContent = {
      available: true,
      schemaHash: lineage.schemaHash ?? null,
      counts,
      records,
      notes: Array.isArray(lineage.notes) ? lineage.notes : [],
    };
    return {
      structuredContent,
      content: contentFromStructured(structuredContent),
    };
  }

  if (name === "get_device_governance_profile") {
    const structuredContent = getDeviceGovernanceProfile();
    return {
      structuredContent,
      content: contentFromStructured(structuredContent),
    };
  }

  if (name === "get_live_telemetry_status") {
    const openCloudPolicy = readRobloxOpenCloudPolicy();
    const structuredContent = {
      configured: openCloudPolicy.configured,
      provider: "Roblox official Open Cloud or MCP-supported interfaces",
      officialInterfacesOnly: true,
      authMode: openCloudPolicy.authMode,
      accessMode: openCloudPolicy.accessMode,
      environments: openCloudPolicy.allowedEnvironments,
      dryRun: openCloudPolicy.dryRun,
      mutationsEnabled: false,
      configurationValid: openCloudPolicy.configurationIssues.length === 0,
      lastCollectionTime: null,
      coverageGaps: openCloudPolicy.configured
        ? [
            "Aggregate AnalyticsService export support must be confirmed against official Roblox interfaces before live values are returned.",
            ...openCloudPolicy.configurationIssues,
          ]
        : [
            "Roblox Open Cloud credentials are not configured for the running server.",
            "No official aggregate AnalyticsService export has been validated for this bridge.",
          ],
    };
    return {
      structuredContent,
      content: contentFromStructured(structuredContent),
    };
  }

  if (name === "get_live_telemetry_aggregates") {
    const environment = String(input.environment ?? "");
    const window = String(input.window ?? "");
    const metricSet = String(input.metricSet ?? "");
    const structuredContent = {
      available: false,
      environment,
      window,
      metricSet,
      reason:
        "Live aggregate telemetry is not returned until an official Roblox aggregate analytics interface is configured and validated; no scraping or cookie fallback is allowed.",
      aggregates: [],
    };
    return {
      structuredContent,
      content: contentFromStructured(structuredContent),
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
  };
}

function jsonRpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonRpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
}

export async function handleRobloxGovernanceMcpJsonRpc(
  request: Request,
  payload: JsonRpcRequest,
) {
  if (!payload.method) {
    return jsonRpcError(payload.id, -32600, "Invalid request");
  }

  if (payload.method === "initialize") {
    return jsonRpcResult(payload.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: SERVER_INSTRUCTIONS,
    });
  }

  if (payload.method === "notifications/initialized") {
    return null;
  }

  if (payload.method === "ping") {
    return jsonRpcResult(payload.id, {});
  }

  if (payload.method === "tools/list") {
    return jsonRpcResult(payload.id, { tools: ROBLOX_GOVERNANCE_MCP_TOOLS });
  }

  if (payload.method === "tools/call") {
    const params = payload.params ?? {};
    const name = typeof params.name === "string" ? params.name : "";
    const input =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};
    if (!name) {
      return jsonRpcError(
        payload.id,
        -32602,
        "tools/call requires params.name",
      );
    }
    const result = await callTool(name, input, request);
    return jsonRpcResult(payload.id, result);
  }

  return jsonRpcError(
    payload.id,
    -32601,
    `Method not found: ${payload.method}`,
  );
}

export async function handleRobloxGovernanceMcpRequest(
  request: Request,
): Promise<Response> {
  let payload: JsonRpcRequest | JsonRpcRequest[];
  try {
    payload = (await request.json()) as JsonRpcRequest | JsonRpcRequest[];
  } catch {
    return new Response(
      JSON.stringify(jsonRpcError(null, -32700, "Parse error")),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const responses = await Promise.all(
    (Array.isArray(payload) ? payload : [payload]).map((item) =>
      handleRobloxGovernanceMcpJsonRpc(request, item),
    ),
  );
  const responsePayload = Array.isArray(payload)
    ? responses.filter(Boolean)
    : responses[0];

  if (!responsePayload) {
    return new Response(null, { status: 202 });
  }

  return new Response(JSON.stringify(responsePayload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function getRobloxGovernanceMcpHealth() {
  return {
    status: "ok",
    serverInfo: SERVER_INFO,
    tools: ROBLOX_GOVERNANCE_MCP_TOOLS.map((tool) => tool.name),
    authentication: "Mixed OAuth",
    officialRobloxInterfacesOnly: true,
  };
}
