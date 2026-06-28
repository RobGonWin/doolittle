# Roblox Governance MCP

Doolittle exposes a tool-only ChatGPT Apps MCP surface for private-safe 1v1 Edit Arena telemetry governance.

The Roblox-side integration reference is the official [Roblox Studio MCP documentation](https://create.roblox.com/docs/studio/mcp).

## Public routes

- `POST /mcp` handles MCP JSON-RPC requests for initialization, tool listing, and tool calls.
- `GET /mcp/health` returns app-facing health and tool names.
- `GET /.well-known/project-association.json` returns the public/private repository association metadata.

Only those exact paths bypass the local Doolittle API token gate. Existing internal routes such as `/mcp/status` and `/mcp/invoke-tool` remain protected by the normal Doolittle API authorization.

## Auth boundary

- `get_project_association` is public and uses `noauth`.
- `get_device_governance_profile` is public and uses `noauth`; it returns planning categories, consent boundaries, prohibited access, and review controls without connecting to devices, Roblox Studio, or live telemetry.
- Telemetry evidence, event lineage, live status, and aggregate tools require OAuth scope `roblox.telemetry.read`.
- Local bearer validation uses `DOOLITTLE_ROBLOX_GOVERNANCE_MCP_BEARER_TOKEN`. Production hosting should replace this with the OAuth provider configured for the submitted ChatGPT app.

## Evidence generation

Generate a reproducible evidence package from a Roblox repository:

```bash
python packages/skills/roblox/telemetry-evidence/scripts/audit_roblox_repo.py C:/path/to/1v1-edit-arena --association-file public-association.json --evidence-dir .doolittle/governance/roblox/<audit-id>
```

The package contains `manifest.json`, `repository-scan.json`, `event-lineage.json`, `findings.json`, `report.md`, and `checksums.sha256`. It stores source references, hashes, counts, and findings; it does not store source snippets, player-level telemetry, raw custom fields, usernames, chat, tokens, keys, or Roblox session cookie values.

If an older local package was generated before association metadata was embedded, the MCP schema evidence tool falls back to `public-association.json` and reports `associationSource: "public-association-fallback"`.

## Live telemetry policy

Live aggregate tools use official Roblox-supported interfaces only. If aggregate AnalyticsService export is not available through an official interface, the tool returns `available: false` with a reason instead of scraping Creator Dashboard or accepting cookie material.

## Proof documents

- `docs/roblox-studio-mcp-boundary.md` documents the split between local Roblox Studio MCP and the public ChatGPT Apps MCP endpoint.
- `docs/chatgpt-developer-mode-proof.md` lists the Developer Mode prompts, expected tools, and negative tests for the submission demo.
- `docs/data-governance-proof.md` records the no-secret test commands and latest targeted governance results.
