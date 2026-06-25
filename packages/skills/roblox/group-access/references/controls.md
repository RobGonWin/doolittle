# Group access controls

Official source: <https://create.roblox.com/docs/cloud/reference/features/groups>

The Groups API exposes membership, role-management, and audit-log surfaces. Collection must record authentication mode, endpoint, pagination cursor, rate-limit result, and authorization failures.

## Privilege classes

- Critical: group ownership, financial authority, credential administration, role administration.
- High: production experience publishing, advertising, moderation administration, broad experience editing.
- Medium: staging publishing, asset management, analytics access, support tooling.
- Low: read-only operational access.

## Deterministic findings

- Critical: automation uses a personal owner or broadly privileged personal account.
- Critical: an unexpected account can manage roles or credentials.
- High: one role can both approve and execute production publishing or ad spend.
- High: dormant or unidentified member retains production privileges.
- High: automation role can access unrelated group resources.
- Medium: no owner is recorded for a privileged role.
- Medium: role or membership changes lack matching audit evidence.
- Medium: pagination or permissions prevent a complete inventory.

## Evidence record

```json
{
  "groupId": "<id>",
  "collectedAt": "<ISO-8601>",
  "roles": [],
  "memberships": [],
  "auditLog": [],
  "coverage": {
    "roles": "complete|partial|denied",
    "memberships": "complete|partial|denied",
    "auditLog": "complete|partial|denied"
  },
  "sourceHashes": {},
  "findings": []
}
```

Use stable user IDs and role IDs in evidence. Display names are mutable and are not sufficient identifiers.
