import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BootstrapAbortError } from "./bootstrap/abort";

describe("bootstrap program", () => {
  beforeEach(() => {
    mock.restore();
    mock.clearAllMocks();
  });

  afterEach(() => {
    mock.restore();
    mock.clearAllMocks();
  });

  it("returns a non-zero status when the wizard aborts", async () => {
    mock.module("./bootstrap/core/env-file", () => ({
      ensureEnvFile: () => [],
      readEnvEntries: () => new Map<string, string>(),
    }));
    mock.module("./bootstrap/persistence/apply", () => ({
      applyBootstrapAnswers: mock(async () => {
        throw new Error("apply should not run after an abort");
      }),
    }));
    mock.module("./bootstrap/wizard/dependencies", () => ({
      getDependencyProbes: () => [],
    }));
    mock.module("./bootstrap/wizard-flow", () => ({
      runWizard: mock(async () => {
        throw new BootstrapAbortError();
      }),
    }));

    const root = mkdtempSync(join(tmpdir(), "doolittle-bootstrap-"));
    try {
      const { runBootstrapProgram } = await import(
        `./bootstrap?bootstrap-tests=${Date.now()}-${Math.random()}`
      );

      await expect(runBootstrapProgram({ root })).resolves.toBe(1);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("prints a file-level dry-run receipt in check mode", async () => {
    mock.module("./bootstrap/core/env-file", () => ({
      ensureEnvFile: () => [".env would be created"],
      readEnvEntries: () => new Map<string, string>(),
    }));
    mock.module("./bootstrap/wizard/dependencies", () => ({
      getDependencyProbes: () => [{ label: "Bun runtime", installed: true }],
    }));
    mock.module("./bootstrap/wizard-flow", () => ({
      runWizard: mock(async () => {
        throw new Error("wizard should not run in check mode");
      }),
    }));

    const root = mkdtempSync(join(tmpdir(), "doolittle-bootstrap-"));
    const lines: string[] = [];
    const logSpy = spyOn(console, "log").mockImplementation(
      (value?: unknown) => {
        lines.push(String(value ?? ""));
      },
    );

    try {
      const { runBootstrapProgram } = await import(
        `./bootstrap?bootstrap-tests=${Date.now()}-${Math.random()}`
      );

      await expect(
        runBootstrapProgram({ root, args: ["--check"] }),
      ).resolves.toBe(0);
    } finally {
      logSpy.mockRestore();
      rmSync(root, { force: true, recursive: true });
    }

    const output = lines.join("\n");

    expect(output).toContain("Doolittle bootstrap");
    expect(output).toContain("mode: check");
    expect(output).toContain("Files:");
    expect(output).toContain("- .env");
    expect(output).toContain("- .doolittle/settings.json");
    expect(output).toContain("- .doolittle/gateway/gateway.json");
    expect(output).toContain("- .doolittle/onboarding.json");
    expect(output).toContain("- .doolittle/onboarding.state.json");
    expect(output).toContain("- Bun runtime: online");
    expect(output).toContain("- .env would be created");
  });
});
