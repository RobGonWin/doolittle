# Research-grade governance evidence

Doolittle treats “research grade” as a reproducibility claim, not an identity,
model-access, or application-portal badge.

## Claim levels

Use the narrowest claim supported by current evidence:

1. **Specified** — controls and expected evidence are documented.
2. **Tested** — automated tests prove the local control boundary.
3. **Observed** — a timestamped collection records a real system state.
4. **Operational** — repeated observations, review history, and incident
   handling show the control continues to work.

The private Discord governance application is currently **tested** after the
governance suite passes. It becomes **observed** only after a live evidence
package is collected from the controlled guild.

## Private Discord boundary

- Application ID: `1519541928990081124`
- Distribution: private, owner-installed, one controlled guild
- Mutation policy: Discord API governance collection is GET-only
- Credential policy: bot token remains in ignored local `.env`
- Identifier policy: stable Discord IDs are retained; usernames are redacted
- Data minimization: message content, email, webhook URLs, profile decoration,
  tokens, and authorization headers are excluded

The portal configuration should use Guild Install only, no default install link,
no public bot distribution, no OAuth2 code grant, and no privileged intents
unless a documented collection requirement exists.

The owner can install the private bot with the initial least-privilege set:

```text
https://discord.com/oauth2/authorize?client_id=1519541928990081124&permissions=117760&integration_type=0&scope=bot
```

## Reproduce the control proof

Run:

```bash
bun run test:governance
```

This proves:

- mutation methods are rejected before network transport;
- arbitrary Discord routes are rejected;
- sensitive response fields and credential values are not serialized;
- rate-limit retries are bounded;
- evidence packages contain manifests, reports, and SHA-256 checksums.

## Produce a live observation

Set these values only in `.env`:

```dotenv
DISCORD_BOT_TOKEN=<secret>
DISCORD_GOVERNANCE_GUILD_ID=<controlled guild id>
```

Collect the baseline:

```bash
bun run audit:discord-governance
```

The command writes:

```text
.doolittle/governance/discord/<audit-id>/
├── manifest.json
├── discord-collection.json
├── report.md
└── checksums.sha256
```

The baseline uses only bot identity, guild, role, and visible-channel reads.
Elevated read routes remain excluded until their permissions are deliberately
approved:

```bash
bun run audit:discord-governance -- --include-elevated
```

## Evidence review rule

Never publish the raw `.doolittle` directory. Review a copy of the generated
package and verify:

- application and guild IDs are correct;
- repository commit and dirty state are recorded;
- every route is marked complete, denied, rate-limited, or error;
- no secret, username, email, webhook URL, or message content appears;
- `checksums.sha256` matches all listed artifacts;
- inaccessible surfaces are reported rather than inferred.

Repository evidence does not prove live Roblox dashboard values. Discord
evidence does not prove GitHub deployment state. Each source must retain its own
collection timestamp, provenance, and explicit coverage gaps.
