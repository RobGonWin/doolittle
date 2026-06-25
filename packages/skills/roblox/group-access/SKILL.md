---
name: group-access
description: Audit Roblox group memberships, roles, permissions, automation accounts, experience ownership, and group audit logs. Use when reviewing who can administer, publish, advertise, manage credentials, change roles, or access group-owned Roblox experiences.
---

# Roblox Group Access

Operate read-only unless the user explicitly approves a membership or role mutation.

1. Identify the group and every group-owned experience in scope.
2. Collect roles, role permissions, memberships, automation accounts, and available audit-log records.
3. Build a privilege map for ownership, role management, experience editing, publishing, advertising, credential management, and financial authority.
4. Separate human operators from automation identities.
5. Flag personal accounts used by automation, dormant privileged members, unexplained role changes, excessive publisher access, and incompatible duties.
6. Preserve pagination, rate-limit, authorization, and collection-gap evidence.
7. Require a before/after snapshot and explicit approval for any role assignment, removal, or permission change.

Read [references/controls.md](references/controls.md) for severity rules and evidence fields.
For the Discord control plane attached to the Roblox operation, read
[references/discord-application-governance.md](references/discord-application-governance.md).

Deliver:

- Role and membership inventory
- Privileged-access graph
- Automation-account assessment
- Group audit-log findings
- Least-privilege remediation plan
