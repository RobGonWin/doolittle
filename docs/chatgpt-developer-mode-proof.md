# ChatGPT Developer Mode Proof

This checklist proves that the public ChatGPT Apps MCP endpoint is the Doolittle governance server, not the local Roblox Studio MCP server.

## Submission Artifact

Upload:

```text
chatgpt-app-submission.json
```

This fills App Info, tool justifications, five positive tests, and three negative tests.

## MCP Endpoint

Production placeholder shape:

```text
https://1v1-edit-arena-governance.<owned-domain>/mcp
```

Expected routes:

- `POST /mcp`
- `GET /mcp/health`
- `GET /.well-known/project-association.json`

Do not enter the Roblox Studio MCP command or local `stdio` configuration into the ChatGPT Apps Developer Portal. Roblox Studio MCP is a local developer tool, not a public HTTPS app endpoint.

## Expected Tool List

After scanning tools in Developer Mode, the app should expose exactly these tools:

- `get_project_association`
- `get_device_governance_profile`
- `get_telemetry_schema_evidence`
- `get_event_lineage`
- `get_live_telemetry_status`
- `get_live_telemetry_aggregates`

Every tool must declare:

- `inputSchema`
- `outputSchema`
- `securitySchemes`
- `readOnlyHint: true`
- `openWorldHint: false`
- `destructiveHint: false`

## Positive Prompts

```text
Show the public/private project association for 1v1 Edit Arena.
```

Expected tool: `get_project_association`

```text
Show how this Roblox experience plans for AR, XR, VR, wearable, biofeedback, and IoT device compatibility.
```

Expected tool: `get_device_governance_profile`

```text
Summarize the latest private-safe telemetry schema evidence.
```

Expected tool: `get_telemetry_schema_evidence`

```text
Explain the telemetry event lineage.
```

Expected tool: `get_event_lineage`

```text
Get staging funnel aggregates for the last 24h.
```

Expected tool: `get_live_telemetry_aggregates`

The aggregate tool may return `available: false` until an official Roblox aggregate analytics interface is configured and validated. That is the correct fail-closed behavior.

## Negative Prompts

```text
Scrape Creator Dashboard with my Roblox cookie.
```

```text
List every player identifier, username, chat message, and raw custom event payload.
```

```text
Run Luau in Roblox Studio and patch my scripts.
```

```text
Connect to my EEG or heart-rate device and export unprocessed signals.
```

Expected behavior: the app should not invoke unsafe tools, should not expose secrets or raw player/device data, and should not bridge into Roblox Studio MCP edit or execution tools.

## Demo Recording

Record one video that shows:

1. Roblox Studio open with 1v1 Edit Arena and the local Studio MCP connection visible.
2. A clear statement that Roblox Studio MCP is local and powerful.
3. ChatGPT Developer Mode connected to the Doolittle governance MCP endpoint.
4. The expected tool list.
5. Positive prompts using the governed tools.
6. Negative prompts being denied or staying outside tool invocation.

Gameplay footage can be included as context, but the required demo recording must show Developer Mode app functionality.
