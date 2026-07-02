# Roblox Open Cloud Integration

This is the additive Open Cloud layer for the existing 1v1 Edit Arena control
plane. It does not replace the Doolittle skills, public governance MCP, local
Studio MCP, Trello workflow, or private game repository.

Official references:

- [API-key management](https://create.roblox.com/docs/cloud/auth/api-keys)
- [Open Cloud scopes](https://create.roblox.com/docs/cloud/reference/scopes)
- [Places APIs](https://create.roblox.com/docs/cloud/reference/features/places)
- [Place publishing](https://create.roblox.com/docs/cloud/guides/usage-place-publishing)

## Boundary model

```text
Public governance MCP (OAuth, read-only evidence)
  -> no Roblox key and no mutation tools

Doolittle private orchestrator
  -> plans jobs, evaluates local policy, packages redacted evidence
  -> does not broaden Roblox key permissions

Private Open Cloud worker
  -> API key in a secret manager/process environment
  -> x-api-key sent only to official Roblox Open Cloud endpoints
  -> staging first; production promotion remains separately approved

Local Roblox Studio MCP
  -> trusted workstation, open Studio session, playtests and selected edits
  -> never exposed through the public MCP
```

Roblox Experience Secrets, shown under an experience's **Configure → Secrets**
page, are for secrets consumed from Roblox `HttpService`. They do not create an
external Open Cloud API key. Create Doolittle's key under **Creator Dashboard →
Credentials → API Keys**.

## Phase 1: read-only governance key

Create one key on a dedicated alternate Roblox account whose group role is
limited to group `32736689`. Restrict the key to only the documented read
operations and, wherever Roblox supports it, these resources:

- production universe `5112018969`, place `14835231599`;
- staging universe `8279974211`, place `126501402641505`.

Do not select write operations as a precaution. Roblox permissions are the
authoritative outer boundary; the local policy is a second, fail-closed check.
Use IP/CIDR restrictions for fixed infrastructure, define a rotation owner, and
account for Roblox's documented 60-day unused/unmodified auto-expiration.

Keep the key value only in a local `.env` or deployment secret manager. Keep the
public `.env.example` value blank. The initial local posture is:

```env
ROBLOX_OPEN_CLOUD_AUTH_MODE=api-key
ROBLOX_OPEN_CLOUD_ACCESS_MODE=read-only
ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS=staging,production
ROBLOX_OPEN_CLOUD_MUTATIONS_REQUIRE_APPROVAL=true
ROBLOX_OPEN_CLOUD_ALLOW_PRODUCTION_MUTATIONS=false
ROBLOX_OPEN_CLOUD_DRY_RUN=true
```

All `ROBLOX_ENABLE_*` mutation flags remain `false`.

## Credential registry

Doolittle resolves credentials by purpose and never treats a shared environment
variable as a key ring:

```env
ROBLOX_PROD_GOVERNANCE_API_KEY=
ROBLOX_STAGING_PLACE_PUBLISHER_API_KEY=
ROBLOX_STAGING_COMMERCE_API_KEY=
ROBLOX_PROD_COMMERCE_READ_API_KEY=
ROBLOX_PROD_COMMERCE_WRITE_API_KEY=
ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY=
```

Each credential has a separate `*_ENABLED` switch that defaults to `false`.
The legacy `ROBLOX_OPEN_CLOUD_API_KEY` is accepted only as a production
governance fallback so existing installations do not break. Supplying both the
legacy and dedicated production governance variables is a configuration error.

Registry status contains only lane ID, target, access class, configured state,
and enabled state. Credential values are resolved only at the outbound request
boundary and are never included in status or evidence.

## Phase 2: separate staging publisher

Create a second key and secret binding rather than expanding the governance
key. Restrict it to the staging experience and the minimum Place Publishing
operation documented by Roblox. Run it only in the private release worker with:

```env
ROBLOX_OPEN_CLOUD_ACCESS_MODE=staging-write
ROBLOX_OPEN_CLOUD_ALLOWED_ENVIRONMENTS=staging
ROBLOX_OPEN_CLOUD_MUTATIONS_REQUIRE_APPROVAL=true
ROBLOX_OPEN_CLOUD_ALLOW_PRODUCTION_MUTATIONS=false
ROBLOX_OPEN_CLOUD_DRY_RUN=false
ROBLOX_ENABLE_PLACE_PUBLISHING=true
```

The release worker must verify the reviewed artifact hash and approval record,
call the local policy gate, publish the exact artifact, and retain only
redacted request/result evidence. The public MCP continues to report posture
and evidence; it never receives the key or publishes.

## Production remains a later lane

Do not reuse the staging key. A production publisher needs a separate key,
protected runtime, exact artifact hash, rollback coordinates, and explicit
approval. The current local policy intentionally denies production mutation.

## Group asset staging workflow

The group asset publisher targets creator/group `32736689` with only
`asset:read` and `asset:write`. Because the Roblox asset scope targets a creator
rather than a universe, Doolittle treats every upload as a staging operation.

Only `.rbxm` and `.rbxmx` inputs are accepted. Doolittle validates the package
marker, records a SHA-256 manifest, requires explicit approval, polls moderation
with a bounded attempt count, and records the returned asset ID against the
staging universe/place. Archive, rollback, deletion, and asset-permission
changes are denied.

Production does not upload a regenerated copy. Promotion means referencing the
exact moderated asset ID and SHA-256 hash proven in staging through a separately
reviewed production place artifact.

The asset lane remains disabled until the private worker supplies the approved
artifact and evidence inputs. The public MCP never accepts asset bytes or owns
the asset credential.

## Minimal integration sequence

1. Create and privately store the read-only governance key.
2. Populate the non-secret metadata and verify key status/scopes manually.
3. Run Doolittle in read-only/dry-run mode and confirm the governance status.
4. Add one official read operation only when its required Roblox scope is
   documented and covered by a redaction test.
5. Introduce the separate staging publisher after read-only evidence is stable.
6. Add group-asset upload only after package validation, hash manifests,
   moderation polling, staging evidence, and exact-ID promotion tests pass.
7. Keep Trello approvals and the existing evidence pipeline as the promotion
   record; do not duplicate them inside the Open Cloud adapter.
