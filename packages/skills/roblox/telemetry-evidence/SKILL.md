---
name: telemetry-evidence
description: Audit Roblox AnalyticsService events, funnels, economy events, progression events, DataStore usage, client-to-server telemetry trust, event cardinality, schema lineage, and repository evidence. Use when reviewing Roblox game analytics, telemetry changes, player-data pipelines, suspicious-activity concerns, or data-backed code recommendations.
---

# Roblox Telemetry Evidence

Base conclusions on repository artifacts and collected metadata, not invented dashboard values.

1. Run `scripts/audit_roblox_repo.py` against each repository in scope.
2. Record repository commit, dirty state, file hashes, scanner version, and collection time.
3. Inventory analytics registries, emitters, client entry points, validation gates, queues, rate limits, data stores, HTTP calls, and environment identifiers.
4. Trace each event from definition to emitter to server validation to Roblox API call.
5. Distinguish production, staging, Studio, client-originated, and server-originated behavior.
6. Flag duplicate semantic events, unstable names, unbounded custom fields, per-event random funnel session IDs, disabled logging calls, client-authoritative values, and missing rejection metrics.
7. Do not classify ordinary legitimate telemetry as "suspicious." Identify concrete abuse, privacy, integrity, cardinality, or policy risks with evidence.
8. Suggest code changes with exact files and deterministic acceptance checks.

Read [references/repository-baseline.md](references/repository-baseline.md) for repository-specific findings and [references/evidence-contract.md](references/evidence-contract.md) for required report structure.

Deliver:

- Evidence manifest
- Event and storage lineage
- Data-quality and trust-boundary findings
- Concrete code suggestions
- Verification and rollout plan
