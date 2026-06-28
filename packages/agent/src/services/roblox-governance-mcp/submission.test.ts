import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROBLOX_GOVERNANCE_MCP_TOOLS } from "./tool-definitions";

interface ChatGptAppSubmission {
  app_info: {
    display_name: string;
    subtitle: string;
    description: string;
    category: string;
  };
  tools: Record<
    string,
    {
      annotations?: Record<string, unknown>;
      justifications?: Record<string, unknown>;
    }
  >;
  test_cases: Array<{
    tools_triggered: string | null;
  }>;
  negative_test_cases: Array<{
    description: string;
    user_prompt: string;
    tools_triggered: string | null;
  }>;
}

function readSubmission(): ChatGptAppSubmission {
  return JSON.parse(
    readFileSync(join(process.cwd(), "chatgpt-app-submission.json"), "utf8"),
  ) as ChatGptAppSubmission;
}

describe("ChatGPT app submission artifact", () => {
  it("backs the public device-governance positioning with implemented tools", () => {
    const submission = readSubmission();
    const description = submission.app_info.description.toLowerCase();
    const positiveToolNames = submission.test_cases.map(
      (testCase) => testCase.tools_triggered,
    );

    expect(submission.tools.get_device_governance_profile).toBeTruthy();
    expect(description).toContain("device");
    expect(description).toContain("ar");
    expect(description).toContain("xr");
    expect(description).toContain("vr");
    expect(description).toContain("biofeedback");
    expect(description).toContain("iot");
    expect(positiveToolNames).toContain("get_device_governance_profile");
  });

  it("stays aligned with the implemented MCP tool descriptors", () => {
    const submission = readSubmission();
    const implementedToolNames = ROBLOX_GOVERNANCE_MCP_TOOLS.map(
      (tool) => tool.name,
    ).sort();
    const submittedToolNames = Object.keys(submission.tools).sort();

    expect(submittedToolNames).toEqual(implementedToolNames);

    for (const descriptor of ROBLOX_GOVERNANCE_MCP_TOOLS) {
      const submittedTool = submission.tools[descriptor.name];
      expect(submittedTool).toBeTruthy();
      expect(descriptor.inputSchema).toBeTruthy();
      expect(descriptor.outputSchema).toBeTruthy();
      expect(descriptor.securitySchemes.length).toBeGreaterThan(0);
      expect(descriptor._meta.securitySchemes).toEqual(
        descriptor.securitySchemes,
      );
      expect(descriptor.annotations).toMatchObject({
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      });
      expect(submittedTool.annotations).toEqual({
        readOnlyHint: descriptor.annotations.readOnlyHint,
        openWorldHint: descriptor.annotations.openWorldHint,
        destructiveHint: descriptor.annotations.destructiveHint,
      });
      expect(submittedTool.justifications).toMatchObject({
        read_only_justification: expect.any(String),
        open_world_justification: expect.any(String),
        destructive_justification: expect.any(String),
      });
    }
  });

  it("keeps the requested positive and negative test coverage shape", () => {
    const submission = readSubmission();
    const implementedToolNames = new Set(
      ROBLOX_GOVERNANCE_MCP_TOOLS.map((tool) => tool.name),
    );

    expect(submission.test_cases).toHaveLength(5);
    expect(submission.negative_test_cases).toHaveLength(3);

    for (const testCase of submission.test_cases) {
      expect(typeof testCase.tools_triggered).toBe("string");
      expect(implementedToolNames.has(testCase.tools_triggered ?? "")).toBe(
        true,
      );
    }

    const negativeTriggeredTools = submission.negative_test_cases
      .map((testCase) => testCase.tools_triggered)
      .filter((toolName): toolName is string => typeof toolName === "string");
    expect(negativeTriggeredTools).toEqual(["get_telemetry_schema_evidence"]);

    const blockedWithoutToolInvocation = submission.negative_test_cases.filter(
      (testCase) => testCase.tools_triggered === null,
    );
    expect(blockedWithoutToolInvocation).toHaveLength(2);
    expect(
      blockedWithoutToolInvocation.some((testCase) =>
        testCase.description.toLowerCase().includes("raw player"),
      ),
    ).toBe(true);
    expect(
      blockedWithoutToolInvocation.some((testCase) =>
        testCase.description.toLowerCase().includes("scraping"),
      ),
    ).toBe(true);
    expect(
      blockedWithoutToolInvocation.some((testCase) =>
        testCase.user_prompt.toLowerCase().includes("biometrics"),
      ),
    ).toBe(true);
  });
});
