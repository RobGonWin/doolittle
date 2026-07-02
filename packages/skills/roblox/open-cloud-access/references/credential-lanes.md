# Doolittle credential lanes and asset workflow

Doolittle uses one environment binding per credential purpose. Never combine
key values or use the backwards-compatible `ROBLOX_OPEN_CLOUD_API_KEY` variable
for a write credential.

| Lane | Secret binding | Required minimum scope |
| --- | --- | --- |
| Production governance | `ROBLOX_PROD_GOVERNANCE_API_KEY` | `universe:read` |
| Staging place publisher | `ROBLOX_STAGING_PLACE_PUBLISHER_API_KEY` | `universe-places:write` |
| Staging commerce | `ROBLOX_STAGING_COMMERCE_API_KEY` | game-pass and developer-product read/write |
| Production commerce read | `ROBLOX_PROD_COMMERCE_READ_API_KEY` | game-pass and developer-product read |
| Production commerce write | `ROBLOX_PROD_COMMERCE_WRITE_API_KEY` | game-pass and developer-product read/write |
| Group asset publisher | `ROBLOX_GROUP_ASSET_PUBLISHER_API_KEY` | `asset:read`, `asset:write` |

Every lane has a separate `*_ENABLED` flag and defaults to disabled. A
configured key is not authorization to run a job. Roblox scopes, the lane flag,
the Doolittle capability flag, dry-run state, target allowlists, and explicit
approval must all pass.

The registry records only whether a lane is configured and enabled. It never
serializes credential values. The legacy key variable may serve only as the
production-governance fallback; configuring both legacy and dedicated bindings
is an error.

## Group asset publisher

Only creator IDs in `ROBLOX_ASSET_ALLOWED_CREATOR_IDS` may be targeted. The 1v1
Edit Arena value is group `32736689`.

Accepted package inputs are `.rbxm` and `.rbxmx`. Before an upload:

1. Validate the extension, Roblox binary/XML marker, and non-empty content.
2. Generate a SHA-256 artifact manifest with logical name, creator, source
   commit, media type, and size.
3. Require the group-asset lane, asset capability, non-dry-run state, and an
   explicit approval record.
4. Poll moderation with a bounded attempt count and record the resulting asset
   ID in staging evidence.
5. Promote only by referencing the exact approved staging asset ID and hash.

Asset archive, rollback, deletion, and permission changes are denied. The
publisher must not receive `asset-permissions:write` or legacy asset scopes.

`.rbxl` and `.rbxlx` are place artifacts, not model-asset inputs. They belong
to the separately scoped place-publishing lane.
