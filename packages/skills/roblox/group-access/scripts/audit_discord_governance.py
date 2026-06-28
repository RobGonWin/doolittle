#!/usr/bin/env python3
"""Collect redacted, read-only Discord governance evidence for one fixed guild."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, NamedTuple

APPLICATION_ID = "1519541928990081124"
API_ROOT = "https://discord.com/api/v10"
COLLECTOR_VERSION = "1.0.0"
POLICY_VERSION = "discord-governance-1.0"
MAX_ATTEMPTS = 3
MAX_RETRY_SECONDS = 5.0

REDACTED_KEYS = {
    "access_token",
    "authorization",
    "avatar",
    "banner",
    "content",
    "email",
    "global_name",
    "locale",
    "refresh_token",
    "secret",
    "token",
    "url",
    "username",
    "webhook_url",
}


class GovernanceBoundaryError(ValueError):
    """Raised when a request attempts to cross the read-only governance boundary."""


class DiscordResponse(NamedTuple):
    status: int
    headers: dict[str, str]
    body: bytes


Transport = Callable[[str, str, dict[str, str]], DiscordResponse]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_snowflake(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized.isdigit() or len(normalized) < 15 or len(normalized) > 22:
        raise GovernanceBoundaryError(f"{label} must be a Discord snowflake ID.")
    return normalized


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def redact(value: Any) -> Any:
    if isinstance(value, list):
        return [redact(entry) for entry in value]
    if not isinstance(value, dict):
        return value

    output: dict[str, Any] = {}
    for key, entry in value.items():
        normalized = key.lower()
        if normalized in REDACTED_KEYS or normalized.endswith("_token"):
            output[key] = "<redacted>"
        else:
            output[key] = redact(entry)
    return output


def git_value(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=root,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip()


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        normalized_name = name.strip()
        if not normalized_name or normalized_name in os.environ:
            continue
        normalized_value = value.strip()
        if (
            len(normalized_value) >= 2
            and normalized_value[0] == normalized_value[-1]
            and normalized_value[0] in {"'", '"'}
        ):
            normalized_value = normalized_value[1:-1]
        os.environ[normalized_name] = normalized_value


def default_transport(
    method: str,
    url: str,
    headers: dict[str, str],
) -> DiscordResponse:
    request = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return DiscordResponse(
                status=response.status,
                headers={key.lower(): value for key, value in response.headers.items()},
                body=response.read(),
            )
    except urllib.error.HTTPError as error:
        return DiscordResponse(
            status=error.code,
            headers={key.lower(): value for key, value in error.headers.items()},
            body=error.read(),
        )


class DiscordGovernanceClient:
    def __init__(
        self,
        token: str,
        guild_id: str,
        *,
        transport: Transport = default_transport,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if not token.strip():
            raise GovernanceBoundaryError("DISCORD_BOT_TOKEN is required.")
        self._token = token.strip()
        self.guild_id = validate_snowflake(guild_id, "guild_id")
        self._transport = transport
        self._sleep = sleep

    def _routes(self) -> dict[str, tuple[str, dict[str, str]]]:
        guild = self.guild_id
        return {
            "bot_identity": ("/users/@me", {}),
            "guild": (f"/guilds/{guild}", {"with_counts": "true"}),
            "roles": (f"/guilds/{guild}/roles", {}),
            "channels": (f"/guilds/{guild}/channels", {}),
            "integrations": (f"/guilds/{guild}/integrations", {}),
            "webhooks": (f"/guilds/{guild}/webhooks", {}),
            "audit_log": (f"/guilds/{guild}/audit-logs", {"limit": "100"}),
        }

    def request(self, method: str, route_label: str) -> dict[str, Any]:
        normalized_method = method.upper()
        if normalized_method != "GET":
            raise GovernanceBoundaryError(
                f"Discord governance collector forbids {normalized_method}; GET is the only allowed method."
            )

        route = self._routes().get(route_label)
        if not route:
            raise GovernanceBoundaryError(
                f"Discord route label is not allowlisted: {route_label}"
            )

        path, query = route
        url = f"{API_ROOT}{path}"
        if query:
            url = f"{url}?{urllib.parse.urlencode(query)}"

        headers = {
            "authorization": f"Bot {self._token}",
            "accept": "application/json",
            "user-agent": (
                f"DoolittleDiscordGovernance/{COLLECTOR_VERSION} "
                f"(application {APPLICATION_ID})"
            ),
        }

        last_response: DiscordResponse | None = None
        attempts = 0
        for attempts in range(1, MAX_ATTEMPTS + 1):
            last_response = self._transport(normalized_method, url, headers)
            if last_response.status != 429 and last_response.status < 500:
                break
            if attempts >= MAX_ATTEMPTS:
                break
            self._sleep(self._retry_delay(last_response))

        assert last_response is not None
        parsed = self._parse_body(last_response.body)
        coverage = self._coverage(last_response.status)
        return {
            "routeLabel": route_label,
            "method": normalized_method,
            "apiRoute": path,
            "statusCode": last_response.status,
            "coverage": coverage,
            "attempts": attempts,
            "collectedAt": utc_now(),
            "discordRequestId": (
                last_response.headers.get("x-request-id")
                or last_response.headers.get("cf-ray")
            ),
            "data": redact(parsed),
        }

    @staticmethod
    def _parse_body(body: bytes) -> Any:
        if not body:
            return None
        try:
            return json.loads(body.decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            return {"unparseableResponse": True, "bodySha256": sha256_bytes(body)}

    @staticmethod
    def _coverage(status: int) -> str:
        if 200 <= status < 300:
            return "complete"
        if status in {401, 403}:
            return "denied"
        if status == 429:
            return "rate-limited"
        return "error"

    @staticmethod
    def _retry_delay(response: DiscordResponse) -> float:
        header = response.headers.get("retry-after")
        if header:
            try:
                return min(max(float(header), 0.0), MAX_RETRY_SECONDS)
            except ValueError:
                pass
        try:
            body = json.loads(response.body.decode("utf-8"))
            return min(max(float(body.get("retry_after", 1.0)), 0.0), MAX_RETRY_SECONDS)
        except (ValueError, TypeError, json.JSONDecodeError):
            return 1.0


def collect(
    client: DiscordGovernanceClient,
    *,
    include_elevated: bool,
) -> dict[str, Any]:
    labels = ["bot_identity", "guild", "roles", "channels"]
    if include_elevated:
        labels.extend(["integrations", "webhooks", "audit_log"])

    records = [client.request("GET", label) for label in labels]
    findings: list[dict[str, Any]] = []

    identity = next(
        (record for record in records if record["routeLabel"] == "bot_identity"),
        None,
    )
    observed_id = identity.get("data", {}).get("id") if identity else None
    if observed_id and observed_id != APPLICATION_ID:
        findings.append(
            {
                "ruleId": "DISCORD-IDENTITY-001",
                "severity": "critical",
                "observedFact": f"Authenticated bot ID is {observed_id}.",
                "expectedState": f"Authenticated bot ID must equal application ID {APPLICATION_ID}.",
                "evidenceIds": ["bot_identity"],
                "remediation": "Stop the collector and replace the local Discord bot token.",
            }
        )

    for record in records:
        if record["coverage"] != "complete":
            findings.append(
                {
                    "ruleId": "DISCORD-COVERAGE-001",
                    "severity": "medium",
                    "observedFact": (
                        f"{record['routeLabel']} collection was "
                        f"{record['coverage']} with HTTP {record['statusCode']}."
                    ),
                    "expectedState": "Every in-scope read-only route should be collected completely.",
                    "evidenceIds": [record["routeLabel"]],
                    "remediation": (
                        "Review the bot's guild installation and least-privilege "
                        "permissions; do not broaden permissions beyond the failed route."
                    ),
                }
            )

    return {
        "schemaVersion": "1.0",
        "collectorVersion": COLLECTOR_VERSION,
        "policyVersion": POLICY_VERSION,
        "applicationId": APPLICATION_ID,
        "guildId": client.guild_id,
        "collectedAt": utc_now(),
        "collectionMode": "read-only",
        "elevatedReadRoutesRequested": include_elevated,
        "records": records,
        "coverage": {
            record["routeLabel"]: record["coverage"] for record in records
        },
        "findings": findings,
        "prohibitedDataCollected": False,
    }


def write_evidence(
    result: dict[str, Any],
    output_root: Path,
    repository_root: Path,
) -> Path:
    audit_id = (
        datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + f"-{result['guildId']}"
    )
    audit_dir = output_root / audit_id
    audit_dir.mkdir(parents=True, exist_ok=False)

    collection_path = audit_dir / "discord-collection.json"
    collection_path.write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    report_lines = [
        "# Discord governance evidence",
        "",
        f"- Audit ID: `{audit_id}`",
        f"- Application ID: `{APPLICATION_ID}`",
        f"- Guild ID: `{result['guildId']}`",
        f"- Collection mode: `{result['collectionMode']}`",
        f"- Collector version: `{COLLECTOR_VERSION}`",
        f"- Policy version: `{POLICY_VERSION}`",
        f"- Repository commit: `{git_value(repository_root, 'rev-parse', 'HEAD') or 'unavailable'}`",
        f"- Dirty worktree: `{bool(git_value(repository_root, 'status', '--porcelain'))}`",
        "",
        "## Coverage",
        "",
    ]
    report_lines.extend(
        f"- `{label}`: `{coverage}`"
        for label, coverage in result["coverage"].items()
    )
    report_lines.extend(
        [
            "",
            "## Evidence limits",
            "",
            "- This collection proves only the listed Discord API observations.",
            "- It does not prove Roblox live telemetry values or GitHub deployment state.",
            "- Denied, rate-limited, omitted, and inaccessible routes remain explicit gaps.",
            "- Tokens, authorization headers, webhook URLs, message content, email, and usernames are excluded.",
            "",
        ]
    )
    report_path = audit_dir / "report.md"
    report_path.write_text("\n".join(report_lines), encoding="utf-8")

    artifact_hashes = {
        collection_path.name: sha256_file(collection_path),
        report_path.name: sha256_file(report_path),
    }
    manifest = {
        "schemaVersion": "1.0",
        "auditId": audit_id,
        "applicationId": APPLICATION_ID,
        "guildId": result["guildId"],
        "collectedAt": result["collectedAt"],
        "collectorVersion": COLLECTOR_VERSION,
        "policyVersion": POLICY_VERSION,
        "repository": {
            "path": str(repository_root),
            "remote": git_value(repository_root, "config", "--get", "remote.origin.url"),
            "commit": git_value(repository_root, "rev-parse", "HEAD"),
            "dirty": bool(git_value(repository_root, "status", "--porcelain")),
        },
        "coverage": result["coverage"],
        "artifacts": artifact_hashes,
        "credentialValuesCollected": False,
    }
    manifest_path = audit_dir / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    checksums = {
        **artifact_hashes,
        manifest_path.name: sha256_file(manifest_path),
    }
    (audit_dir / "checksums.sha256").write_text(
        "".join(f"{digest}  {name}\n" for name, digest in sorted(checksums.items())),
        encoding="utf-8",
    )
    return audit_dir


def main() -> int:
    load_env_file(Path.cwd() / ".env")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--guild-id",
        default=os.getenv("DISCORD_GOVERNANCE_GUILD_ID", ""),
        help="Controlled Discord guild ID; defaults to DISCORD_GOVERNANCE_GUILD_ID.",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        default=Path(".doolittle/governance/discord"),
    )
    parser.add_argument(
        "--repository-root",
        type=Path,
        default=Path.cwd(),
    )
    parser.add_argument(
        "--include-elevated",
        action="store_true",
        help="Also request integrations, webhooks, and audit logs using GET only.",
    )
    args = parser.parse_args()

    token = os.getenv("DISCORD_BOT_TOKEN", "")
    client = DiscordGovernanceClient(token, args.guild_id)
    result = collect(client, include_elevated=args.include_elevated)
    audit_dir = write_evidence(
        result,
        args.output_root.resolve(),
        args.repository_root.resolve(),
    )
    print(audit_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
