---
name: release-ads-governance
description: Govern Roblox source exports, RTFusion file operations, place publishing, production and staging separation, sponsored campaign access, budget approvals, eligibility checks, and advertising attribution. Use when preparing Roblox releases, changing RTFusion tooling, publishing places, or reviewing Ads Manager and sponsored campaign operations.
---

# Roblox Release and Ads Governance

Treat publishing and ad-spend changes as separate approved operations.

1. Bind every release artifact to repository, commit, dirty state, target universe, target place, environment, builder version, and SHA-256 checksum.
2. Reject production publishing from a dirty worktree unless an approved exception is recorded.
3. Review RTFusion file operations for workspace confinement, recoverability, path portability, symlink handling, and explicit confirmation for destructive actions.
4. Verify advertising authentication at the individual endpoint level; do not infer support from feature-level documentation.
5. Never store or automate with `.ROBLOSECURITY`.
6. Require campaign eligibility, target ownership, creative identity, budget ceiling, schedule, approver, stop condition, and telemetry attribution before spend.
7. Keep campaign creation and stopping behind explicit approval and capture the resulting campaign identifiers without authentication material.
8. Compare post-release and post-campaign telemetry only against documented metrics and time windows.

Read [references/controls.md](references/controls.md) for repository-specific controls and code suggestions.

Deliver:

- Release provenance manifest
- RTFusion safety findings
- Publishing target verification
- Campaign authorization and budget record
- Attribution and rollback plan
