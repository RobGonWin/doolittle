# Repository baseline

This baseline was derived from local working copies on June 25, 2026. Re-run the scanner before relying on it.

## `RobGonWin/1v1-edit-arena`

Observed surfaces:

- `src/ServerStorage/+ServerLibrary/GameServices/+TrackingAnalyticsService/Get-IncludedAnalytics.luau` defines allowlisted custom, economy, funnel, onboarding, and progression telemetry.
- `Queue-AnalyticsEvent.luau` queues events, calculates a player-dependent rate limit, separates some client-originated events, and routes onboarding categories.
- The worktree had uncommitted edits in both files when this baseline was prepared. Preserve those user changes.
- `ExperienceInfo.luau` contains production/staging identifiers in source.
- ProfileService and ordered data stores provide persistent player and leaderboard data.
- Analytics emitters are distributed across versus edits, training, quests, shops, progression, onboarding, and UI interactions.
- HTTP request helpers and player lookup/proxy code create an external-data trust boundary.

Concrete code suggestions:

1. Replace the duplicated `Funnel.Onboarding` and `Funnel.Miscellaneous` step tables with one canonical schema plus an explicit destination mapping. This prevents names and step numbers from drifting.
2. Replace string flags such as `"InvokedFromAnalyticsQueue"` with booleans or a typed invocation context table.
3. Generate one funnel-session ID per player funnel attempt and reuse it across steps. Generating an ID inside each log call prevents reliable step correlation.
4. Add structured rejection counters for unknown path, invalid type, client-disallowed event, queue overflow, rate-limit deferral, and missing player.
5. Validate custom-field keys, types, string lengths, and cardinality. Server-side event-name allowlisting alone does not bound custom dimensions.
6. Assign a schema version and stable event ID to every event. Record environment and server build version as bounded fields.
7. Keep production and staging schemas identical while separating data with an explicit environment field and target universe/place.
8. Add static tests that every emitted event resolves to exactly one registry entry and that no registry entry is orphaned.
9. Do not emit player names in warning logs. Use user IDs only where operationally required and avoid retaining them in governance artifacts.
10. Verify whether progression logging is intentionally disabled: the `AnalyticsService:LogProgressionEvent` call was commented in the inspected implementation.

## `RobGonWin/rtfusion-explorer-private`

Observed surfaces:

- The VS Code extension reads and mutates the first workspace's `src` tree.
- File operations include recursive copy, move, rename, cut, paste, delete, undo, and redo.
- Some cut/undo paths use permanent deletion with `useTrash: false`.
- Packing invokes an external `codepack` process.
- `PACKED_ROOT` is documented as a hard-coded user-specific Windows path.
- Webview messages carry local paths into extension-host file operations.

Concrete code suggestions:

1. Resolve an operator-configured export directory through a VS Code setting instead of a hard-coded absolute path.
2. Canonicalize every source and destination with `realpath`, then require both to remain under the intended workspace or export root.
3. Reject symlink/junction escapes and cross-root moves.
4. Validate webview messages with a discriminated schema before constructing `vscode.Uri.file`.
5. Require confirmation for recursive delete, permanent cut, overwrite, and packing outside the workspace.
6. Write an append-only operation journal containing operation ID, timestamp, action, relative paths, pre/post hashes, result, and extension version.
7. Make undo artifacts durable across extension restarts, or stop claiming recoverability for operations that cannot be restored.
8. Invoke `codepack` with an argument array, captured exit code, timeout, and artifact hash. Record the exact tool version.
9. Bind packed artifacts to the source Git commit and dirty state.
10. Align the package license declaration with `LICENSE.md` before distribution.
