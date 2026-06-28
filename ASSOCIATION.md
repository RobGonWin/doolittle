# Project Association

This public repository is the public-facing MCP/OAuth adapter and proof surface
for the private Roblox game source listed below.

## Public Adapter

- Repository: `RobGonWin/doolittle`
- GitHub repository ID: `1279785952`
- Visibility: `public`
- Default branch: `main`

## Private Game Source

- Repository: `RobGonWin/1v1-edit-arena`
- GitHub repository ID: `974969495`
- Visibility: `private`
- Default branch: `prod`
- Roblox experience name: `1v1 Edit Arena`

## Shared Ownership

- GitHub owner: `RobGonWin`
- GitHub owner ID: `177498987`

## Relationship

`RobGonWin/doolittle` is the public MCP/OAuth adapter used to expose approved
tooling, governance documents, and public verification metadata for
`RobGonWin/1v1-edit-arena`. The private repository remains the authoritative
source code for the Roblox game and is not mirrored here.

The public MCP endpoint should serve the same relationship metadata at:

```text
/.well-known/project-association.json
```

When a hosted MCP endpoint is assigned, record it in
`public-association.json` and in the private game's
`docs/public-mcp-endpoint.md`.
