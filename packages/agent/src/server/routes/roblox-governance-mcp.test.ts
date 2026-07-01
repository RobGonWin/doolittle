import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppContext } from "@/runtime/bootstrap";
import {
  handleRobloxGovernanceMcpRoutes,
  isRobloxGovernancePublicRoute,
} from "./roblox-governance-mcp";

const context = {} as AppContext;

async function callMcp(
  body: Record<string, unknown>,
  authorization?: string,
): Promise<Record<string, unknown>> {
  const response = await handleRobloxGovernanceMcpRoutes(
    context,
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify(body),
    }),
    new URL("http://localhost/mcp"),
  );
  expect(response).not.toBeNull();
  return (await response?.json()) as Record<string, unknown>;
}

describe("handleRobloxGovernanceMcpRoutes", () => {
  afterEach(() => {
    delete process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN;
    delete process.env.DOOLITTLE_ROBLOX_GOVERNANCE_EVIDENCE_ROOT;
    delete process.env.ROBLOX_OPEN_CLOUD_API_KEY;
    delete process.env.ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS;
    delete process.env.ROBLOX_OPEN_CLOUD_AUTH_MODE;
    delete process.env.ROBLOX_OPEN_CLOUD_ACCESS_MODE;
    delete process.env.ROBLOX_OPEN_CLOUD_DRY_RUN;
  });

  it("exposes only the app-facing public route paths", () => {
    expect(isRobloxGovernancePublicRoute(new URL("http://x/mcp"))).toBe(true);
    expect(isRobloxGovernancePublicRoute(new URL("http://x/mcp/health"))).toBe(
      true,
    );
    expect(
      isRobloxGovernancePublicRoute(
        new URL("http://x/.well-known/project-association.json"),
      ),
    ).toBe(true);
    expect(isRobloxGovernancePublicRoute(new URL("http://x/mcp/status"))).toBe(
      false,
    );
  });

  it("lists tools with explicit annotations, schemas, and security schemes", async () => {
    const payload = await callMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const result = payload.result as { tools: Array<Record<string, unknown>> };

    expect(result.tools).toHaveLength(6);
    for (const tool of result.tools) {
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.outputSchema).toBeTruthy();
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      });
      expect(Array.isArray(tool.securitySchemes)).toBe(true);
    }
  });

  it("allows public project association without OAuth", async () => {
    const payload = await callMcp({
      jsonrpc: "2.0",
      id: "assoc",
      method: "tools/call",
      params: { name: "get_project_association", arguments: {} },
    });
    const result = payload.result as {
      structuredContent: Record<string, unknown>;
      isError?: boolean;
    };

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.relationship).toBe(
      "public_mcp_oauth_adapter_for_private_roblox_game_source",
    );
  });

  it("allows public device governance profile without OAuth", async () => {
    const payload = await callMcp({
      jsonrpc: "2.0",
      id: "device-profile",
      method: "tools/call",
      params: { name: "get_device_governance_profile", arguments: {} },
    });
    const encoded = JSON.stringify(payload);
    const result = payload.result as {
      structuredContent: Record<string, unknown>;
      isError?: boolean;
    };
    const privacyBoundary = result.structuredContent.privacyBoundary as Record<
      string,
      unknown
    >;

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent.available).toBe(true);
    expect(Array.isArray(result.structuredContent.deviceCategories)).toBe(true);
    expect(privacyBoundary.deviceAccessGranted).toBe(false);
    expect(privacyBoundary.rawSensorDataCollected).toBe(false);
    expect(privacyBoundary.biometricDataCollected).toBe(false);
    expect(encoded).not.toContain("UserId");
    expect(encoded).not.toContain("ROBLOSECURITY");
    expect(encoded).not.toContain("CustomEventFields");
  });

  it("returns an OAuth challenge for protected telemetry tools", async () => {
    process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN = "review-token";
    const payload = await callMcp({
      jsonrpc: "2.0",
      id: "schema",
      method: "tools/call",
      params: { name: "get_telemetry_schema_evidence", arguments: {} },
    });
    const result = payload.result as {
      isError?: boolean;
      _meta?: Record<string, unknown>;
    };

    expect(result.isError).toBe(true);
    expect(result._meta?.["mcp/www_authenticate"]).toContain(
      "roblox.telemetry.read",
    );
  });

  it("returns aggregate unavailable status without raw telemetry fields", async () => {
    process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN = "review-token";
    const payload = await callMcp(
      {
        jsonrpc: "2.0",
        id: "aggregates",
        method: "tools/call",
        params: {
          name: "get_live_telemetry_aggregates",
          arguments: {
            environment: "staging",
            window: "24h",
            metricSet: "funnel",
          },
        },
      },
      "Bearer review-token",
    );
    const encoded = JSON.stringify(payload);
    const result = payload.result as {
      structuredContent: Record<string, unknown>;
    };

    expect(result.structuredContent.available).toBe(false);
    expect(encoded).not.toContain("UserId");
    expect(encoded).not.toContain("DisplayName");
    expect(encoded).not.toContain("CustomEventFields");
    expect(encoded).not.toContain("ROBLOSECURITY");
  });

  it("reports live telemetry status without exposing credential variable names", async () => {
    process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN = "review-token";
    const payload = await callMcp(
      {
        jsonrpc: "2.0",
        id: "live-status",
        method: "tools/call",
        params: {
          name: "get_live_telemetry_status",
          arguments: {},
        },
      },
      "Bearer review-token",
    );
    const encoded = JSON.stringify(payload);
    const result = payload.result as {
      structuredContent: Record<string, unknown>;
    };

    expect(result.structuredContent.configured).toBe(false);
    expect(encoded).not.toContain("ROBLOX_OPEN_CLOUD_API_KEY");
    expect(encoded).not.toContain(
      "DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN",
    );
  });

  it("reports read-only Open Cloud posture without returning the key", async () => {
    process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN = "review-token";
    process.env.ROBLOX_OPEN_CLOUD_API_KEY = "private-open-cloud-key";
    process.env.ROBLOX_OPEN_CLOUD_AUTH_MODE = "api-key";
    process.env.ROBLOX_OPEN_CLOUD_ACCESS_MODE = "read-only";
    process.env.ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS = "staging,production";
    process.env.ROBLOX_OPEN_CLOUD_DRY_RUN = "true";

    const payload = await callMcp(
      {
        jsonrpc: "2.0",
        id: "open-cloud-posture",
        method: "tools/call",
        params: {
          name: "get_live_telemetry_status",
          arguments: {},
        },
      },
      "Bearer review-token",
    );
    const encoded = JSON.stringify(payload);
    const result = payload.result as {
      structuredContent: Record<string, unknown>;
    };

    expect(result.structuredContent).toMatchObject({
      configured: true,
      authMode: "api-key",
      accessMode: "read-only",
      environments: ["staging", "production"],
      dryRun: true,
      mutationsEnabled: false,
      configurationValid: true,
    });
    expect(encoded).not.toContain("private-open-cloud-key");
  });

  it("sanitizes schema evidence before returning it through the public tool", async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "doolittle-evidence-"));
    try {
      const packageDir = join(tempRoot, "audit-1");
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(
        join(packageDir, "manifest.json"),
        JSON.stringify({ schemaVersion: "1.0" }),
      );
      writeFileSync(
        join(packageDir, "repository-scan.json"),
        JSON.stringify({
          schemaVersion: "1.0",
          scannerVersion: "1.1.0",
          collectedAt: "2026-06-25T00:00:00.000Z",
          schemaHash: "schema-hash",
          repository: {
            path: "C:/private/1v1-edit-arena",
            remote: null,
            commit: "abc123",
            dirty: true,
          },
          coverage: {
            textFilesScanned: 10,
            ignoredFiles: ["api_key.txt", "pc-receive-session-data.json"],
            ignoredDirectories: [".git", "node_modules"],
            liveRobloxTelemetryCollected: false,
            credentialValuesCollected: false,
            sourceSnippetsCollected: false,
          },
          inventory: {
            analytics_api: { count: 2, locations: [] },
          },
          findings: [],
          redactionAudit: {
            passed: true,
            sourceSnippetsCollected: false,
            playerLevelTelemetryCollected: false,
            credentialValuesCollected: false,
          },
        }),
      );
      writeFileSync(
        join(packageDir, "event-lineage.json"),
        JSON.stringify({ schemaHash: "schema-hash" }),
      );
      writeFileSync(join(packageDir, "findings.json"), JSON.stringify({}));

      process.env.DOOLITTLE_ROBLOX_GOVERNANCE_EVIDENCE_ROOT = tempRoot;
      process.env.DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN = "review-token";
      const payload = await callMcp(
        {
          jsonrpc: "2.0",
          id: "schema",
          method: "tools/call",
          params: {
            name: "get_telemetry_schema_evidence",
            arguments: {},
          },
        },
        "Bearer review-token",
      );
      const encoded = JSON.stringify(payload);
      const result = payload.result as {
        structuredContent: Record<string, unknown>;
      };
      const association = result.structuredContent.association as Record<
        string,
        unknown
      >;

      expect(result.structuredContent.available).toBe(true);
      expect(result.structuredContent.associationSource).toBe(
        "public-association-fallback",
      );
      expect(association.relationship).toBe(
        "public_mcp_oauth_adapter_for_private_roblox_game_source",
      );
      expect(result.structuredContent.coverage).toMatchObject({
        textFilesScanned: 10,
        ignoredFilePolicyCount: 2,
        ignoredDirectoryCount: 2,
        credentialValuesCollected: false,
        sourceSnippetsCollected: false,
      });
      expect(encoded).not.toContain("api_key.txt");
      expect(encoded).not.toContain("pc-receive-session-data.json");
      expect(encoded).not.toContain("C:/private/1v1-edit-arena");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
