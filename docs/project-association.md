# Public Association for 1v1 Edit Arena

This document explains how the public `RobGonWin/doolittle` repository proves
its relationship to the private `RobGonWin/1v1-edit-arena` Roblox game source
without exposing private game code.

## What This Proves

- `RobGonWin/doolittle` is the public MCP/OAuth adapter repository.
- `RobGonWin/1v1-edit-arena` is the private Roblox game source repository.
- Both repositories are controlled by the same GitHub owner, `RobGonWin`.
- The public adapter can be used as the public proof surface for Roblox app
  registration, domain verification, MCP tool descriptions, OAuth governance,
  and deployment metadata.

## Stable Identifiers

| Item | Value |
| --- | --- |
| Public adapter repository | `RobGonWin/doolittle` |
| Public adapter repository ID | `1279785952` |
| Public adapter default branch | `main` |
| Private game repository | `RobGonWin/1v1-edit-arena` |
| Private game repository ID | `974969495` |
| Private game default branch | `prod` |
| GitHub owner | `RobGonWin` |
| GitHub owner ID | `177498987` |
| Roblox experience name | `1v1 Edit Arena` |

## Proof Chain

The intended chain of custody is:

```text
Roblox app registration
  -> public HTTPS MCP URL
  -> /.well-known/project-association.json
  -> RobGonWin/doolittle
  -> public-association.json
  -> private repo identity: RobGonWin/1v1-edit-arena, repo ID 974969495
  -> shared GitHub owner ID: 177498987
```

## How To Verify

1. Open the public repository:

   ```text
   https://github.com/RobGonWin/doolittle
   ```

2. Confirm this repository contains:

   ```text
   ASSOCIATION.md
   public-association.json
   docs/project-association.md
   ```

3. Confirm `public-association.json` declares:

   ```json
   {
     "public_adapter": {
       "repository": "RobGonWin/doolittle",
       "repository_id": 1279785952
     },
     "private_game_source": {
       "repository": "RobGonWin/1v1-edit-arena",
       "repository_id": 974969495
     },
     "owner": {
       "login": "RobGonWin",
       "github_user_id": 177498987
     }
   }
   ```

4. When the HTTPS MCP endpoint is deployed, confirm it serves the same JSON at:

   ```text
   https://<your-mcp-domain>/.well-known/project-association.json
   ```

5. Register the MCP server in Roblox with:

   ```text
   https://<your-mcp-domain>/mcp
   ```

6. Keep Roblox authentication set to OAuth and use only the scopes required by
   the approved tools.

## What This Does Not Expose

This repository does not publish or mirror the private game source. It only
publishes stable identity metadata and the public adapter surface needed for
review, deployment, OAuth, and MCP registration.

## Next Live Endpoint Step

After a production HTTPS MCP endpoint exists, update:

- `public-association.json` in this repository.
- `docs/public-mcp-endpoint.md` in `RobGonWin/1v1-edit-arena`.
- The public `/.well-known/project-association.json` response on the MCP host.
