# 1v1 Edit Arena Discord application governance

This record documents the Discord application used as the operator interface for
the Roblox governance skills. It contains identifiers and configuration
guidance, never credential values.

## Registered application

| Field | Recorded value |
| --- | --- |
| Application name | `1v1 Edit Arena Governance` |
| Application ID | `1519541928990081124` |
| Purpose | Read-only governance reports and approved Doolittle operator commands |
| Owning Discord account | `1v1EditArena` |
| Recorded on | `2026-06-25` |
| Initial install state | 0 servers, 0 individual users |
| Credential variable | `DISCORD_BOT_TOKEN` |
| Credential storage | Local ignored `.env`; never Git or Discord messages |

The application ID is a public identifier. The bot token, OAuth client secret,
interaction endpoint credentials, webhook tokens, and user session credentials
are secrets and must not appear in this file.

Machine-readable metadata is recorded in
[`discord-application-manifest.json`](discord-application-manifest.json).

## GitHub production context

The connected GitHub application was used to inspect the committed `prod`
branch of `RobGonWin/1v1-edit-arena`.

| Evidence | Committed SHA |
| --- | --- |
| `README.md` | `b27100804ca2f953f8f6581b237ead27ae8a2556` |
| `default.project.json` | `2dd12a2a957e69dd7d3305bdae69efb0f9b43415` |
| `ExperienceInfo.luau` | `05aa62a55412a096f4a9eeaf85b772fcfc02050f` |
| `Get-IncludedAnalytics.luau` | `4fae57891c8c843d80622234aeb1cd36e299c6f2` |
| `Queue-AnalyticsEvent.luau` | `c273d3418595b6019ce8eab4b3a52fdde10c1882` |
| `GameProgressionRequirements.luau` | `4d1052b813bb0fe00fe123ca6e9a87f23af74b8a` |

The Rojo project maps `ReplicatedStorage`, `ServerScriptService`,
`ServerStorage`, and `StarterPlayer` into `src`. Governance analysis should
therefore treat those four trees as the primary runtime source surface.

Committed environment identifiers:

| Environment | Universe ID | Place ID |
| --- | --- | --- |
| Production | `5112018969` | `14835231599` |
| Staging | `8279974211` | `126501402641505` |

Canonical production experience:
<https://www.roblox.com/games/14835231599/1v1-Edit-Arena>

Owning Roblox community:
<https://www.roblox.com/communities/32736689/1v1-Edit-Arena>

| Roblox ownership field | Value |
| --- | --- |
| Group/community name | `1v1 Edit Arena` |
| Group ID | `32736689` |
| Governance role | Ownership and access-control root for the experience |

These IDs are public resource identifiers, not credentials. The bot must include
the environment in every report and must never combine production and staging
metrics without an explicit comparison operation.

Group membership, role assignment, experience publishing, advertising, and
Open Cloud automation must be evaluated against group `32736689`. A personal
account's access to this group does not make that personal account an
appropriate long-lived automation identity.

## General Information

Use this portal description:

> Operator bot for 1v1 Edit Arena governance. Produces source-backed reports for
> Roblox telemetry, group access, releases, advertising, and Discord
> integrations. Defaults to read-only collection, redacts credentials and
> player-level data, and requires explicit approval before mutations.

Suggested tags:

- `Roblox`
- `Analytics`
- `Moderation`
- `Utilities`
- `Developer Tools`

An icon is optional. Use the 1v1 Edit Arena mark only if it is an approved,
non-secret brand asset.

## Capability boundary

The Discord application is an interface and evidence source. It does not own or
contain Roblox Open Cloud credentials or GitHub credentials.

```text
Discord bot token -> Discord transport and Discord evidence
GitHub credential  -> repository reads and approved repository writes
Roblox API key     -> explicitly scoped Roblox Open Cloud operations
```

Never copy one credential into another system's configuration.

## Repository-derived telemetry scope

The committed game describes a social Roblox experience with versus edits,
spectator interaction, chat, cosmetic forms, progression, quests, shops, and
community moderation. Its analytics registry includes:

- Versus outcomes, opponents, deciding stats, wins/losses, streaks, and pad
  behavior.
- Spectator counts, watch duration, full-watch status, and match message count.
- Training sessions and stat gains.
- Form, feat, pose, background, and scaling selection.
- Quest, shop, progression, rebirth, settings, economy, and onboarding events.

The queue implementation rejects client-originated Custom and Economy events,
allows Funnel events from clients, applies a player-dependent rate limit, and
temporarily disables Progression event delivery. The onboarding configuration
includes spectating an edit and chatting while watching.

This creates the following governance boundary:

1. Roblox remains the authoritative source for gameplay telemetry.
2. GitHub remains the authoritative source for event schemas and emitting code.
3. Discord receives aggregate findings, alerts, and approval requests.
4. Discord messages are not a replacement telemetry pipeline.
5. A Discord user statement must not directly mutate player data, campaign
   state, group roles, or production code.

Recommended Discord report dimensions:

- `environment`: `production` or `staging`
- `universeId` and `placeId`
- `repositoryCommit`
- `analyticsSchemaHash`
- `policyVersion`
- `observationWindow`
- aggregate event counts and rejection counts
- coverage and data-quality status

Do not post player-level match records, chat contents, usernames, UserIds,
inventory details, or raw custom event fields to Discord. For a debugging case,
use a short-lived case identifier and retain the sensitive evidence in an
approved local store.

## Setup sequence

### 1. Bot page

- Create the bot user if Discord has not already created it.
- Reset the token only when the current token is unavailable or suspected
  exposed.
- Store the current value only as `DISCORD_BOT_TOKEN` in the ignored `.env`.
- Disable Public Bot unless installation by unrelated server owners is
  intentionally supported.
- Leave Presence Intent disabled.
- Enable Message Content Intent only if Doolittle must read ordinary channel
  messages rather than interactions or explicit webhooks.
- Enable Server Members Intent only when implementing a complete member-to-role
  governance inventory.

Do not enable intents merely because they are available. Record the reason and
collection requirement for each enabled privileged intent.

### 2. Installation page

Install to the single controlled 1v1 Edit Arena server first.

Initial transport permissions:

- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files

Do not request `Administrator`.

The current Doolittle Discord adapter supports message delivery but does not yet
perform the governance collection described below. Therefore, do not grant
elevated governance permissions until the collector exists and has tests.

Later read-only governance permissions:

- View Audit Log: required to retrieve administrative history.
- Manage Server: Discord requires this to list server integrations. This
  permission can also authorize mutations, so Doolittle code must enforce a
  read-only API allowlist.
- Manage Webhooks: required to inventory guild webhooks. Grant only if webhook
  inventory is in scope.

### 3. Doolittle gateway

Keep these values in `.env`:

```dotenv
DISCORD_BOT_TOKEN=<secret>
DOOLITTLE_ALLOW_ALL_USERS=false
DOOLITTLE_PAIRING_MODE=pair
```

The token value must never be copied into a skill, report, issue, commit,
terminal transcript, screenshot, or chat message.

Enable Discord in `.doolittle/gateway/gateway.json` after onboarding:

```json
{
  "platforms": {
    "discord": {
      "enabled": true,
      "allowAllUsers": false,
      "allowedUserIds": [],
      "pairingMode": "pair"
    }
  }
}
```

Pair the sole operator account before accepting commands. Keep
`allowAllUsers=false` even when only one person currently administers the
system.

## Telemetry and evidence rules

Record operational metadata:

- Application ID, guild ID, channel ID, message ID, and Discord audit-log ID.
- Event type, collection time, API route label, status code, and Discord request
  or trace identifier when available.
- Doolittle run ID, repository commit, policy version, and evidence hash.
- Whether coverage was complete, partial, rate-limited, denied, or truncated.

Do not store:

- Bot tokens, webhook tokens, OAuth secrets, or authorization headers.
- Message bodies unrelated to an explicitly requested governance operation.
- Voice recordings or voice-channel audio.
- Raw player telemetry or Roblox API keys.
- Usernames as durable identifiers when stable Discord user IDs are available.

Default retention:

- Governance manifests and findings: retain according to the project audit
  policy.
- Raw Discord response bodies: minimize and delete after normalized evidence is
  produced unless required for an active investigation.
- Discord audit-log snapshots: collect at least every 30 days if historical
  review is required, because Discord retains audit entries for 45 days.

## Required collector controls

Before granting elevated Discord permissions, implement and test:

1. A fixed allowlist of read-only Discord routes.
2. A fixed allowlist containing only the controlled guild ID.
3. Response redaction for tokens, webhook URLs, message content, email, and
   unnecessary user profile fields.
4. Pagination and truncation reporting.
5. SHA-256 evidence manifests without secret material.
6. Rate-limit handling with bounded retries.
7. Execution approval for every POST, PUT, PATCH, or DELETE request.
8. Tests proving the governance action cannot call mutation routes.

Minimum read-only collection:

- Guild security configuration.
- Roles and permission bitfields.
- Channels and permission overwrites.
- Integration inventory.
- Webhook metadata when explicitly enabled.
- Audit-log entries.
- Bot identity and its effective permissions.

Minimum Roblox/GitHub correlation:

- Compare the deployed environment to the committed universe and place IDs.
- Compare observed event names to `AnalyticSafePaths`.
- Record whether an event was client-originated or server-originated.
- Report queue rejection, rate-limit deferral, disabled progression logging,
  and unknown-schema events as separate counters.
- Link code suggestions to repository path, commit, and source hash.
- Require staging evidence before recommending a production telemetry change.

## Incident and recovery procedure

If the token might be exposed:

1. Stop Doolittle and any other bot process.
2. Reset the bot token in the Developer Portal.
3. Replace only the local `DISCORD_BOT_TOKEN` value.
4. Restart and verify the bot identity.
5. Review Discord audit logs and local Doolittle traces.
6. Record the incident time, reason, operator, affected environments, and
   recovery evidence without recording either token.

If application ownership is lost, create a replacement application, test it,
then remove the inaccessible bot from the server. A server installation cannot
reveal the bot token.

## Current implementation status

As recorded on June 25, 2026:

- The application exists and has no installations yet.
- Doolittle accepts `DISCORD_BOT_TOKEN`.
- Doolittle can send Discord messages and participate in the gateway.
- GitHub is authenticated separately through the local GitHub CLI.
- The Roblox governance skills and redacted repository scanner exist.
- A Discord governance collector/action has not yet been implemented.

Do not describe the Discord governance audit as operational until the collector,
route allowlist, redaction, and tests are present.
