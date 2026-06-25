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


if __name__ == "__main__":
    unittest.main()
