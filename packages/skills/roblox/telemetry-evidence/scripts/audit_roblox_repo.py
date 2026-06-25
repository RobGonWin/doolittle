#!/usr/bin/env python3
"""Create a value-redacted governance inventory for Roblox-related repositories."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCANNER_VERSION = "1.0.0"
IGNORED_DIRS = {
    ".git",
    "node_modules",
    "out",
    "dist",
    "build",
    "coverage",
    ".next",
}
IGNORED_FILES = {
    "package-lock.json",
    "reactBundle.js",
    "reactBundle.js.LICENSE.txt",
}
TEXT_SUFFIXES = {
    ".lua",
    ".luau",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".md",
    ".toml",
    ".yml",
    ".yaml",
}

PATTERNS: dict[str, re.Pattern[str]] = {
    "analytics_api": re.compile(
        r"\b(?:LogCustomEvent|LogEconomyEvent|LogFunnelStepEvent|"
        r"LogOnboardingFunnelStepEvent|LogProgressionEvent)\b"
    ),
    "analytics_service": re.compile(r'GetService\(["\']AnalyticsService["\']\)'),
    "data_store": re.compile(
        r"\b(?:DataStoreService|GetDataStore|GetOrderedDataStore|ProfileService)\b"
    ),
    "memory_store": re.compile(r"\bMemoryStoreService\b"),
    "http_boundary": re.compile(
        r"\b(?:HttpService|GetAsync|PostAsync|RequestAsync|fetch)\b"
    ),
    "group_access": re.compile(
        r"\b(?:GroupService|GetRankInGroup|GetRoleInGroup|groupId|group_id)\b",
        re.IGNORECASE,
    ),
    "environment_id": re.compile(
        r"\b(?:UniverseIds?|PlaceIds?|ProductionPlaceId|StagingPlaceId)\b"
    ),
    "destructive_file_operation": re.compile(
        r"\b(?:workspace\.fs\.delete|fs\.promises\.rename|"
        r"fs\.promises\.writeFile|copyFile|useTrash\s*:\s*false)\b"
    ),
    "child_process": re.compile(r"\b(?:child_process|cp\.spawn|spawn\()\b"),
    "absolute_windows_path": re.compile(r"[A-Za-z]:[\\/][^\"'\r\n]+"),
    "roblox_cookie": re.compile(r"\.ROBLOSECURITY", re.IGNORECASE),
}

SECRET_ASSIGNMENT = re.compile(
    r"""(?ix)
    \b(?P<name>
      [A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|COOKIE)[A-Z0-9_]*
    )\b
    \s*(?:=|:)
    \s*(?P<value>["'][^"'\r\n]{8,}["'])
    """
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def iter_text_files(root: Path):
    for current_root, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
        for name in sorted(files):
            if name in IGNORED_FILES:
                continue
            path = Path(current_root, name)
            if path.suffix.lower() in TEXT_SUFFIXES or name in {
                "Dockerfile",
                ".gitignore",
            }:
                yield path


def line_record(path: Path, root: Path, line_number: int) -> dict[str, Any]:
    return {
        "path": path.relative_to(root).as_posix(),
        "line": line_number,
    }


def scan(root: Path) -> dict[str, Any]:
    matches: dict[str, list[dict[str, Any]]] = {
        name: [] for name in PATTERNS
    }
    secret_indicators: list[dict[str, Any]] = []
    evidence_files: dict[str, str] = {}

    for path in iter_text_files(root):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        file_matched = False
        for line_number, line in enumerate(text.splitlines(), start=1):
            for name, pattern in PATTERNS.items():
                if pattern.search(line):
                    matches[name].append(line_record(path, root, line_number))
                    file_matched = True

            for secret_match in SECRET_ASSIGNMENT.finditer(line):
                secret_indicators.append(
                    {
                        **line_record(path, root, line_number),
                        "identifier": secret_match.group("name"),
                        "value": "<redacted>",
                    }
                )
                file_matched = True

        if file_matched:
            evidence_files[path.relative_to(root).as_posix()] = sha256(path)

    commit = git_value(root, "rev-parse", "HEAD")
    status = git_value(root, "status", "--porcelain")
    remote = git_value(root, "config", "--get", "remote.origin.url")

    findings: list[dict[str, Any]] = []
    if secret_indicators:
        findings.append(
            {
                "ruleId": "RBX-CRED-001",
                "severity": "critical",
                "summary": "Potential literal credential assignments were detected.",
                "evidenceCount": len(secret_indicators),
            }
        )
    if matches["roblox_cookie"]:
        findings.append(
            {
                "ruleId": "RBX-CRED-002",
                "severity": "critical",
                "summary": ".ROBLOSECURITY references require removal or manual-only handling.",
                "evidenceCount": len(matches["roblox_cookie"]),
            }
        )
    if matches["absolute_windows_path"]:
        findings.append(
            {
                "ruleId": "RBX-RELEASE-001",
                "severity": "medium",
                "summary": "Hard-coded absolute Windows paths reduce portability and provenance.",
                "evidenceCount": len(matches["absolute_windows_path"]),
            }
        )
    if matches["destructive_file_operation"]:
        findings.append(
            {
                "ruleId": "RBX-REPO-001",
                "severity": "medium",
                "summary": "Destructive file operations require root confinement and journaling.",
                "evidenceCount": len(matches["destructive_file_operation"]),
            }
        )
    if matches["analytics_api"] and not matches["analytics_service"]:
        findings.append(
            {
                "ruleId": "RBX-TEL-001",
                "severity": "medium",
                "summary": "Analytics emitters were found without an obvious AnalyticsService acquisition.",
                "evidenceCount": len(matches["analytics_api"]),
            }
        )

    return {
        "schemaVersion": "1.0",
        "scannerVersion": SCANNER_VERSION,
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "repository": {
            "path": str(root),
            "remote": remote,
            "commit": commit,
            "dirty": bool(status),
        },
        "coverage": {
            "textFilesScanned": sum(1 for _ in iter_text_files(root)),
            "ignoredDirectories": sorted(IGNORED_DIRS),
            "ignoredFiles": sorted(IGNORED_FILES),
            "liveRobloxTelemetryCollected": False,
            "credentialValuesCollected": False,
        },
        "inventory": {
            name: {"count": len(records), "locations": records}
            for name, records in matches.items()
        },
        "secretIndicators": secret_indicators,
        "evidenceFiles": evidence_files,
        "findings": findings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("repository", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    root = args.repository.resolve()
    if not root.is_dir():
        parser.error(f"repository is not a directory: {root}")

    result = scan(root)
    encoded = json.dumps(result, indent=2, sort_keys=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
