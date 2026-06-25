# Release and advertising controls

Official sources:

- <https://create.roblox.com/advertise/manage>
- <https://create.roblox.com/docs/cloud/reference/features/sponsored-campaigns>

## Endpoint authentication

Verify authentication on each endpoint before implementation. The sponsored-campaign feature page currently lists API key, OAuth, and cookie at the feature level, while documented create/list/stop campaign endpoints specify cookie authentication. Do not assume that an API key is accepted because the feature page lists it.

Never collect, store, or automate with `.ROBLOSECURITY`. If an operation lacks an appropriate supported automation method, keep it as an approved manual Ads Manager step.

## Campaign approval record

Require:

- Group and experience owner.
- Universe and campaign target IDs.
- Eligible-target verification.
- Creative ID and immutable creative checksum/reference.
- Daily and total budget ceilings.
- Start/end times and timezone.
- Targeting configuration.
- Named approver and operator roles.
- Stop-loss conditions.
- Predeclared attribution metrics and observation window.
- Resulting campaign/ad-set IDs.

Do not allow an agent to create or stop a campaign without explicit approval for that exact target, creative, budget, and schedule.

## Release manifest

```json
{
  "repository": "RobGonWin/1v1-edit-arena",
  "commit": "<sha>",
  "dirty": false,
  "builder": {
    "name": "rtfusion-explorer",
    "version": "<version>"
  },
  "target": {
    "environment": "staging|production",
    "universeId": "<id>",
    "placeId": "<id>"
  },
  "artifactSha256": "<hash>",
  "approvals": [],
  "createdAt": "<ISO-8601>"
}
```

## RTFusion implementation changes

In `rtfusion-explorer-private`:

- Replace the hard-coded `PACKED_ROOT` with `rtfusionExplorer.packedRoot`.
- Add `assertPathWithinRoot(candidate, root)` after canonicalizing both paths.
- Validate all webview messages before file operations.
- Journal destructive operations and artifact hashes.
- Default deletes to trash and require confirmation for permanent deletion.
- Capture `codepack` version, exit code, timeout, stdout/stderr summary, and output hash.
