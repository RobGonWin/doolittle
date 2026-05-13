import type { NativePluginCatalogSeed } from "./types";

export const EXECUTION_PLUGIN_CATALOG_SEEDS: NativePluginCatalogSeed[] = [
  {
    id: "execution.e2b",
    packageName: "@elizaos/plugin-e2b",
    category: "execution",
    source: "official",
    kind: "adapter",
    maturity: "alpha",
    enablement: "always",
    notes:
      "Official E2B sandbox service for secure code execution and autocoder support.",
  },
  {
    id: "execution.forms",
    packageName: "@elizaos/plugin-forms",
    category: "execution",
    source: "vendored",
    kind: "adapter",
    maturity: "alpha",
    persistence: "injected",
    enablement: "always",
    notes:
      "Workspace-native forms plugin used by autocoder and guided workflow flows.",
  },
  {
    id: "execution.coding-agent",
    packageName: "@doolittle/plugin-coding-agent",
    category: "execution",
    source: "custom",
    kind: "adapter",
    maturity: "alpha",
    enablement: "always",
    notes:
      "Doolittle coding agent service bridging workspace, repository, shell, and delegation. Consolidated into doolittle-plugin.",
  },
  {
    id: "execution.agent-orchestrator",
    packageName: "@doolittle/plugin-agent-orchestrator",
    category: "execution",
    source: "custom",
    kind: "adapter",
    maturity: "alpha",
    enablement: "always",
    notes:
      "Doolittle delegation orchestrator with supervision and queue management. Consolidated into doolittle-plugin.",
  },
  {
    id: "execution.planning",
    packageName: "@elizaos/plugin-planning",
    category: "execution",
    source: "vendored",
    kind: "adapter",
    maturity: "alpha",
    persistence: "injected",
    enablement: "always",
    notes:
      "Workspace-native planning plugin linking native delegation tasks and workflow graphs.",
  },
];
