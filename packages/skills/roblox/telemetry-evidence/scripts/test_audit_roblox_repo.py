from __future__ import annotations

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("audit_roblox_repo.py")
SPEC = importlib.util.spec_from_file_location("audit_roblox_repo", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class AuditRobloxRepoTest(unittest.TestCase):
    def test_redacts_secret_values_and_finds_governance_surfaces(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "game.luau").write_text(
                "\n".join(
                    [
                        'local AnalyticsService = game:GetService("AnalyticsService")',
                        'AnalyticsService:LogCustomEvent(player, "Joined")',
                        'local ROBLOX_API_KEY = "literal-secret-value"',
                        'local DataStoreService = game:GetService("DataStoreService")',
                    ]
                ),
                encoding="utf-8",
            )

            result = MODULE.scan(root)
            encoded = json.dumps(result)

            self.assertEqual(result["inventory"]["analytics_api"]["count"], 1)
            self.assertGreater(result["inventory"]["data_store"]["count"], 0)
            self.assertEqual(result["secretIndicators"][0]["value"], "<redacted>")
            self.assertNotIn("literal-secret-value", encoded)
            self.assertEqual(result["findings"][0]["ruleId"], "RBX-CRED-001")

    def test_cookie_marker_in_docs_is_not_a_runtime_critical(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            docs = root / "docs"
            docs.mkdir()
            (docs / "public-mcp-endpoint.md").write_text(
                "Never publish .ROBLOSECURITY in public evidence.",
                encoding="utf-8",
            )

            result = MODULE.scan(root)

            self.assertEqual(result["inventory"]["roblox_cookie"]["count"], 1)
            self.assertEqual(result["findings"][0]["ruleId"], "RBX-CRED-002-DOC")
            self.assertEqual(result["findings"][0]["severity"], "informational")

    def test_skips_known_ignored_private_key_and_session_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "api_key.txt").write_text(
                'ROBLOX_API_KEY = "literal-private-key"',
                encoding="utf-8",
            )
            (root / "pc-receive-session-data.json").write_text(
                '{"UserId": 123456, "DisplayName": "Private"}',
                encoding="utf-8",
            )
            (root / "game.luau").write_text(
                'AnalyticsService:LogCustomEvent(player, "Joined")',
                encoding="utf-8",
            )

            result = MODULE.scan(root)
            encoded = json.dumps(result)

            self.assertEqual(result["secretIndicators"], [])
            self.assertNotIn("literal-private-key", encoded)
            self.assertEqual(result["coverage"]["textFilesScanned"], 1)
            self.assertNotIn("pc-receive-session-data.json", result["evidenceFiles"])

    def test_writes_reproducible_evidence_package_without_source_snippets(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "repo"
            root.mkdir()
            subprocess.run(["git", "init", "-q"], cwd=root, check=True)
            (root / "public-association.json").write_text(
                json.dumps(
                    {
                        "public_adapter": {"repository": "RobGonWin/doolittle"},
                        "private_game_source": {
                            "repository": "RobGonWin/1v1-edit-arena"
                        },
                    }
                ),
                encoding="utf-8",
            )
            (root / "game.luau").write_text(
                "\n".join(
                    [
                        "local AnalyticsTypeData = {}",
                        "TrackingAnalyticsServiceContainer.AnalyticSafePaths = {}",
                        'AnalyticsService:LogFunnelStepEvent(player, "GameLoop", 1)',
                    ]
                ),
                encoding="utf-8",
            )
            evidence_dir = Path(temp_dir) / "evidence"

            result = MODULE.write_evidence_package(root, evidence_dir)
            manifest = json.loads((evidence_dir / "manifest.json").read_text())
            lineage = json.loads((evidence_dir / "event-lineage.json").read_text())
            encoded_scan = (evidence_dir / "repository-scan.json").read_text()

            self.assertEqual(manifest["privacy"]["sourceSnippetsCollected"], False)
            self.assertIn("schemaHash", manifest)
            self.assertGreater(len(lineage["emitters"]), 0)
            self.assertTrue((evidence_dir / "checksums.sha256").is_file())
            self.assertEqual(result["manifest"]["association"]["public_adapter"]["repository"], "RobGonWin/doolittle")
            self.assertNotIn('AnalyticsService:LogFunnelStepEvent(player, "GameLoop", 1)', encoded_scan)


if __name__ == "__main__":
    unittest.main()
