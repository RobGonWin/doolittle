# Open Cloud control set

Official source: <https://create.roblox.com/docs/cloud/auth/api-keys>

Roblox documents that API-key authority derives from the owning user, including group-owned resources that user can access. Some scopes can be restricted to an experience, but not all. Roblox recommends:

- Grant only required operations and resource scopes.
- Restrict the key to specific experiences when supported.
- Use CIDR/IP restrictions for fixed external infrastructure.
- Use expiration with an operational rotation process.
- Store secrets outside source control; use Secrets Store inside Roblox experiences.
- Use a dedicated alternate account with only the minimum target-group role for group automation.
- Remove unused keys. Unused or unmodified keys can auto-expire after 60 days.

Creator Dashboard **Experience Secrets** are a different feature. They store
secrets for use by an experience through `HttpService`; they are not where an
external Doolittle process creates or stores its Open Cloud API key. Create the
external key on Creator Dashboard's Credentials / API Keys page and inject it
into the Doolittle runtime from a private environment or secret manager.

## Required inventory fields

Record only metadata:

```json
{
  "keyLabel": "ci-place-publisher",
  "purpose": "Publish the staging place",
  "ownerType": "dedicated-group-automation-account",
  "groupId": "<id>",
  "universeIds": ["<staging-universe-id>"],
  "placeIds": ["<staging-place-id>"],
  "scopes": ["<documented-scope>"],
  "ipRestriction": "configured|not-applicable|missing",
  "expirationState": "active|expired|auto-expired|revoked|moderated",
  "lastVerifiedAt": "<ISO-8601>",
  "rotationOwner": "<role, not secret>",
  "evidenceIds": ["..."]
}
```

Never include the API-key value, OAuth access token, refresh token, client secret, or `.ROBLOSECURITY`.

## Repository checks

- Search tracked files for credential variable names and high-confidence assignments.
- Report file, line, and identifier only. Do not emit the assigned value.
- Check `.gitignore`, CI secret references, deployment configuration, and documentation for consistent variable names.
- Compare every API call to an explicit purpose and minimum scope.
- Treat wildcard resource identifiers and disabled experience restriction as high risk unless justified.

## Suggested integration pattern

External TypeScript:

```ts
const apiKey = process.env.ROBLOX_OPEN_CLOUD_API_KEY;
if (!apiKey) throw new Error("ROBLOX_OPEN_CLOUD_API_KEY is required");

const response = await fetch(url, {
  headers: {
    "x-api-key": apiKey,
    "content-type": "application/json",
  },
});
```

Keep the value in the process environment or secret manager. Log only the request purpose, resource identifier, status code, Roblox request ID when available, and a redacted credential label.

## Doolittle policy boundary

The runtime policy is additive to Roblox scopes. It can deny an operation but
must never treat a local flag as permission Roblox did not grant. The safe
initial posture is `read-only`, `dry-run`, approval required, production
mutations disabled, and every mutation capability disabled.

Before a staging publisher is introduced, use a separate API key restricted to
the staging universe/place and enable only `place-publishing`. Keep the public
governance MCP read-only; a private release worker owns the key and invokes the
policy check immediately before an Open Cloud request.
