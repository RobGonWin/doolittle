---
name: open-cloud-access
description: Audit Roblox Open Cloud API keys, OAuth clients, Secrets Store usage, scopes, resource restrictions, expiration, rotation, and group-owned automation accounts. Use when reviewing Roblox credentials, CI integrations, external tools, data-store access, place publishing, or any code that authenticates to Roblox APIs.
---

# Roblox Open Cloud Access

Treat credential values as volatile secrets. Never print, persist, hash into reports, or place them in prompts.

1. Identify the automation purpose, owning account, target group, universe, place, and required operations.
2. Inspect repositories for credential variable names and unsafe storage without reading values into the report.
3. Compare granted scopes and resources with the minimum required by the code.
4. Prefer a dedicated alternate account restricted to the target group over a personal-account key.
5. Require experience restrictions where the scope supports them, IP restrictions for fixed external infrastructure, and a documented rotation owner.
6. Record key metadata only: key label, owner type, scope names, resource IDs, expiration state, last verification time, and evidence references.
7. Treat absent inventory, unrestricted resources, wildcard resource identifiers, source-controlled secrets, and undocumented ownership as findings.
8. Require explicit approval before creating, regenerating, disabling, or deleting credentials.

Read [references/controls.md](references/controls.md) for the control set and
implementation patterns. For Doolittle credential lanes or model-asset
automation, also read
[references/credential-lanes.md](references/credential-lanes.md).

Deliver:

- Credential inventory with values redacted
- Least-privilege comparison
- Rotation and expiration status
- Group-resource isolation findings
- Credential-lane enablement status without credential values
- Asset artifact hash, moderation, staging evidence, and promotion findings
- Evidence-backed remediation plan
