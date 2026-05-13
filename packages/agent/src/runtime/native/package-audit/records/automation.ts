import type { NativePackageAuditRecord } from "../types";

export const NATIVE_AUTOMATION_PACKAGE_AUDIT_RECORDS: NativePackageAuditRecord[] =
  [
    {
      packageName: "@doolittle/plugin-action-bench",
      role: "research",
      currentStrategy: "vendored",
      currentTag: "workspace",
      latestTagVersion: "1.4.4",
      compatibility: "vendored-by-design",
      note: "Workspace-native action-bench plugin replaces the lagging published line so benchmark coverage stays native to the current runtime stack.",
    },
    {
      packageName: "@doolittle/plugin-autocoder",
      role: "research",
      currentStrategy: "vendored",
      currentTag: "workspace",
      latestTagVersion: "1.3.3",
      compatibility: "vendored-by-design",
      note: "Workspace-native autocoder plugin replaces the older published line so code generation, GitHub, and secrets services boot cleanly on the current runtime stack.",
    },
  ];
