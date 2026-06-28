from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("audit_discord_governance.py")
SPEC = importlib.util.spec_from_file_location(
    "audit_discord_governance",
    SCRIPT_PATH,
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DiscordGovernanceCollectorTest(unittest.TestCase):
    def test_forbids_mutation_methods_and_unknown_routes(self) -> None:
        calls = []

        def transport(method, url, headers):
            calls.append((method, url, headers))
            return MODULE.DiscordResponse(200, {}, b"{}")

        client = MODULE.DiscordGovernanceClient(
            "secret-token",
            "123456789012345678",
            transport=transport,
        )

        with self.assertRaises(MODULE.GovernanceBoundaryError):
            client.request("POST", "guild")
        with self.assertRaises(MODULE.GovernanceBoundaryError):
            client.request("GET", "arbitrary_route")
        self.assertEqual(calls, [])

    def test_redacts_sensitive_fields_and_never_serializes_token(self) -> None:
        response = {
            "id": MODULE.APPLICATION_ID,
            "username": "operator-bot",
            "email": "private@example.com",
            "token": "response-secret",
            "content": "unrelated message",
            "nested": {"webhook_url": "https://discord.example/secret"},
        }

        def transport(method, url, headers):
            self.assertEqual(method, "GET")
            self.assertIn("Bot secret-token", headers["authorization"])
            return MODULE.DiscordResponse(
                200,
                {"x-request-id": "request-1"},
                json.dumps(response).encode(),
            )

        client = MODULE.DiscordGovernanceClient(
            "secret-token",
            "123456789012345678",
            transport=transport,
        )
        result = client.request("GET", "bot_identity")
        encoded = json.dumps(result)

        self.assertEqual(result["data"]["id"], MODULE.APPLICATION_ID)
        self.assertEqual(result["data"]["username"], "<redacted>")
        self.assertNotIn("secret-token", encoded)
        self.assertNotIn("response-secret", encoded)
        self.assertNotIn("private@example.com", encoded)
        self.assertNotIn("unrelated message", encoded)

    def test_retries_are_bounded_and_rate_limit_delay_is_capped(self) -> None:
        responses = [
            MODULE.DiscordResponse(
                429,
                {"retry-after": "99"},
                b'{"retry_after":99}',
            ),
            MODULE.DiscordResponse(200, {}, b'{"id":"ok"}'),
        ]
        sleeps = []

        def transport(method, url, headers):
            return responses.pop(0)

        client = MODULE.DiscordGovernanceClient(
            "secret-token",
            "123456789012345678",
            transport=transport,
            sleep=sleeps.append,
        )
        result = client.request("GET", "guild")

        self.assertEqual(result["attempts"], 2)
        self.assertEqual(result["coverage"], "complete")
        self.assertEqual(sleeps, [MODULE.MAX_RETRY_SECONDS])

    def test_writes_reproducible_redacted_evidence_artifacts(self) -> None:
        result = {
            "schemaVersion": "1.0",
            "collectorVersion": MODULE.COLLECTOR_VERSION,
            "policyVersion": MODULE.POLICY_VERSION,
            "applicationId": MODULE.APPLICATION_ID,
            "guildId": "123456789012345678",
            "collectedAt": "2026-06-25T12:00:00+00:00",
            "collectionMode": "read-only",
            "elevatedReadRoutesRequested": False,
            "records": [],
            "coverage": {"guild": "complete"},
            "findings": [],
            "prohibitedDataCollected": False,
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            audit_dir = MODULE.write_evidence(result, root / "evidence", root)

            self.assertTrue((audit_dir / "manifest.json").is_file())
            self.assertTrue((audit_dir / "discord-collection.json").is_file())
            self.assertTrue((audit_dir / "report.md").is_file())
            checksums = (audit_dir / "checksums.sha256").read_text()
            self.assertIn("manifest.json", checksums)
            self.assertIn("discord-collection.json", checksums)
            self.assertIn("report.md", checksums)


if __name__ == "__main__":
    unittest.main()
