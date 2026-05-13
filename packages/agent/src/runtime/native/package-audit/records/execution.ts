import type { NativePackageAuditRecord } from "../types";

export const NATIVE_EXECUTION_PACKAGE_AUDIT_RECORDS: NativePackageAuditRecord[] =
  [
    {
      packageName: "@elizaos/plugin-e2b",
      role: "execution",
      currentStrategy: "official",
      currentTag: "workspace",
      latestTagVersion: "1.2.0",
      compatibility: "workspace-only",
      note: "Official E2B plugin is patched through the local workspace so its source can run cleanly on the current 2.x alpha stack.",
    },
    {
      packageName: "@elizaos/plugin-forms",
      role: "execution",
      currentStrategy: "vendored",
      currentTag: "workspace",
      latestTagVersion: "1.2.0",
      compatibility: "vendored-by-design",
      note: "Workspace-native forms plugin replaces the older published line so persistence and runtime lifecycle stay aligned with the current 2.x alpha stack.",
    },
    {
      packageName: "@doolittle/plugin-coding-agent",
      role: "execution",
      currentStrategy: "vendored",
      currentTag: "workspace",
      latestTagVersion: "consolidated",
      compatibility: "vendored-by-design",
      note: "Doolittle coding agent consolidated into doolittle-plugin.",
    },
    {
      packageName: "@doolittle/plugin-agent-orchestrator",
      role: "execution",
      currentStrategy: "vendored",
      currentTag: "workspace",
      latestTagVersion: "consolidated",
      compatibility: "vendored-by-design",
      note: "Doolittle delegation orchestrator consolidated into doolittle-plugin.",
    },
    {
      packageName: "@elizaos/plugin-planning",
      role: "execution",
      currentStrategy: "vendored",
      currentTag: "workspace",
      latestTagVersion: "1.2.0",
      alphaTagVersion: "2.0.0-alpha.3",
      compatibility: "vendored-by-design",
      note: "Workspace-native planning plugin links native delegation and workflow graphs on the current 2.x alpha stack.",
    },
  ];
