# Telemetry evidence contract

An audit is “proven” only to the extent that another operator can reproduce the collection and rule evaluation.

Every report must contain:

- Repository URL and local path.
- Git commit and dirty-worktree state.
- Scanner and policy-pack versions.
- Collection timestamp.
- SHA-256 for each cited source artifact.
- Rule identifier, severity, observed fact, expected state, evidence IDs, and remediation.
- Explicit inaccessible or uncollected surfaces.
- A statement that repository evidence does not prove live dashboard values.

Suggested artifact layout:

```text
.doolittle/governance/roblox/<audit-id>/
├── manifest.json
├── repository-scan.json
├── event-lineage.json
├── findings.json
├── report.md
└── checksums.sha256
```

Do not store player-level raw telemetry in these artifacts. Prefer aggregate counts, schema metadata, hashed source artifacts, and stable repository references.

For Discord-linked governance evidence, also include the Discord application ID,
guild ID, collection coverage, API route labels, and audit-log entry IDs. Never
include bot tokens, webhook tokens, authorization headers, or unrelated message
content. See
[`../../group-access/references/discord-application-governance.md`](../../group-access/references/discord-application-governance.md).
