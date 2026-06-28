# Data Governance Proof

This proof package demonstrates that the Doolittle ChatGPT Apps MCP surface is private-safe and does not blindly accept Roblox, device, or telemetry commands.

## Local Commands

Run from the repository root:

```powershell
bun test packages/agent/src/services/roblox-governance-mcp/submission.test.ts packages/agent/src/server/routes/roblox-governance-mcp.test.ts packages/agent/src/server/auth.test.ts
```

```powershell
python -m unittest -v packages/skills/roblox/telemetry-evidence/scripts/test_audit_roblox_repo.py packages/skills/roblox/group-access/scripts/test_audit_discord_governance.py
```

```powershell
bunx tsc --noEmit --pretty false
```

```powershell
bunx @biomejs/biome check packages/agent/src/services/roblox-governance-mcp/submission.test.ts packages/agent/src/services/roblox-governance-mcp/tool-definitions.ts packages/agent/src/services/roblox-governance-mcp/server.ts packages/agent/src/server/routes/roblox-governance-mcp.test.ts docs/roblox-governance-mcp.md docs/roblox-studio-mcp-boundary.md docs/chatgpt-developer-mode-proof.md docs/data-governance-proof.md chatgpt-app-submission.json
```

## Latest Local Result

The current targeted validation passed with:

- MCP/auth/submission tests: `17 pass`, `0 fail`
- Roblox governance scanner tests: `8 pass`, `0 fail`
- TypeScript check: pass
- Targeted Biome check: pass
- Unauthorized protected evidence denied: true
- Auth challenge present: true
- Forbidden response scan: false for every public/protected tool response

## Data Classes Not Returned

The MCP responses are checked to avoid returning:

- Roblox session-cookie material
- Player-level identifiers
- Display names
- Raw custom event fields
- API keys or bearer tokens
- Private source snippets
- Raw chat content
- Unprocessed biometric or device signals
- Creator Dashboard scraped data

## No-Secret CI Scope

The repository proof workflow is intentionally no-secret. It validates the governance contract without requiring GitHub repository secrets, Roblox Open Cloud keys, OAuth client secrets, or private Roblox source material.

Secrets are only needed for a deployed production endpoint or a future official live aggregate provider integration. They should be configured as deployment or GitHub environment secrets, never committed to the repository.
