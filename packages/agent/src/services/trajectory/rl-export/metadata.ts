export function describeTrajectoryRlExport(totalSessions: number): string {
  return [
    "RL Export Capabilities:",
    `  Sessions available: ${totalSessions}`,
    "  Formats: JSONL (windowed turn format, Doolittle training schema)",
    "  Schema: doolittle-rl-v1",
    "  Methods:",
    "    exportRlReady(sessionId)  — single session RL export",
    "    exportRlDataset()         — all sessions combined RL export",
  ].join("\n");
}
