# Roblox Studio MCP Boundary

This repository treats the official Roblox Studio MCP server as a local, trusted developer surface. It is not the public ChatGPT Apps MCP endpoint.

Official reference: https://create.roblox.com/docs/studio/mcp

## What Roblox Documents

Roblox Studio includes a built-in MCP server that connects AI clients to an open Studio session. The server uses `stdio` transport and can inspect the data model, read and edit scripts, execute Luau, control play mode, capture output, and simulate input.

On Windows, Roblox documents this local MCP configuration:

```json
{
  "mcpServers": {
    "Roblox_Studio": {
      "command": "cmd.exe",
      "args": [
        "/c",
        "%LOCALAPPDATA%\\Roblox\\mcp.bat"
      ]
    }
  }
}
```

This is intentionally local-first. It is not an HTTPS URL and it should not be exposed as the submitted ChatGPT Apps server.

## Public App Boundary

The submitted ChatGPT App uses Doolittle's governance MCP server:

```text
https://1v1-edit-arena-governance.<owned-domain>/mcp
```

Until production hosting is assigned, use this as the placeholder shape only. The final hostname must be a domain controlled by the app owner.

The public app does not bridge arbitrary prompts into Roblox Studio MCP. It exposes only governed, read-only tools:

- `get_project_association`
- `get_device_governance_profile`
- `get_telemetry_schema_evidence`
- `get_event_lineage`
- `get_live_telemetry_status`
- `get_live_telemetry_aggregates`

## Denied Public Capabilities

The public app must not expose these Roblox Studio MCP capabilities:

- Script edits through Studio MCP
- Arbitrary Luau execution
- Creator Store insertion
- Play mode control
- Keyboard or mouse simulation
- Raw Studio console export beyond governed summaries
- Creator Dashboard scraping
- Roblox session-cookie material
- Raw player-level telemetry
- Unprocessed device or biometric signals

## Demo Proof

A compliant demo can show Roblox Studio MCP connected locally, then switch to ChatGPT Developer Mode and prove that the public app does not directly invoke Studio edit, execution, playtest, or input-simulation tools.
