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

SCANNER_VERSION = "1.1.0"
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
    ".env",
    "api_key.txt",
    "group_asset_import_key.txt",
    "package-lock.json",
    "pc-receive-session-data.json",
    "reactBundle.js",
    "reactBundle.js.LICENSE.txt",
    "user_asset_import_key.txt",
}
DOC_OR_TEST_PARTS = {
    "__tests__",
    "docs",
    "examples",
    "fixtures",
    "references",
    "testdata",
}
PLACEHOLDER_FILE_NAMES = {
    ".env.example",
    "env.example",
    "example.env",
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

ANALYTIC_SAFE_PATH = re.compile(r"\bAnalyticSafePaths\b")
ANALYTICS_TYPE_DATA = re.compile(r"\bAnalyticsTypeData\b")
ANALYTICS_CALL = re.compile(
    r"\b(?:AnalyticsService:)?(?:LogCustomEvent|LogEconomyEvent|"
    r"LogFunnelStepEvent|LogOnboardingFunnelStepEvent|LogProgressionEvent)\b"
)
QUEUE_VALIDATION = re.compile(
    r"\b(?:IsSentFromClient|AnalyticSafePaths|Reject|Invalid|Queue|RateLimit|"
    r"InvokedFromAnalyticsQueue)\b"
)
ONBOARDING_ROUTING = re.compile(
    r"\b(?:Onboarding|Miscellaneous|GameLoop|ChangePlayerFirstTimeExperienceStep)\b"
)
TRUST_BOUNDARY = re.compile(
    r"\b(?:OnServerEvent|OnServerFired|RemoteEvent|RemoteFunction|"
    r"IsSentFromClient|Player|UserId)\b"
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


def path_class(path: Path, root: Path) -> str:
    try:
        relative = path.relative_to(root)
    except ValueError:
        relative = path
    parts = {part.lower() for part in relative.parts}
    name = relative.name.lower()
    if name in PLACEHOLDER_FILE_NAMES:
        return "placeholder"
    if any(part in DOC_OR_TEST_PARTS for part in parts):
        return "documentation_or_test"
    if name.endswith((".test.ts", ".test.py", ".spec.ts", ".spec.js")):
        return "documentation_or_test"
    return "runtime"


def line_record(path: Path, root: Path, line_number: int) -> dict[str, Any]:
    return {
        "path": path.relative_to(root).as_posix(),
        "line": line_number,
        "classification": path_class(path, root),
    }


def count_runtime(records: list[dict[str, Any]]) -> int:
    return sum(1 for record in records if record.get("classification") == "runtime")


def count_actionable_secret_indicators(records: list[dict[str, Any]]) -> int:
    return sum(
        1
        for record in records
        if record.get("classification") not in {"documentation_or_test", "placeholder"}
    )


def load_public_association(
    root: Path,
    association_file: Path | None = None,
) -> dict[str, Any] | None:
    association_path = association_file or (root / "public-association.json")
    if not association_path.is_file():
        return None
    try:
        return json.loads(association_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def append_lineage_record(
    bucket: list[dict[str, Any]],
    path: Path,
    root: Path,
    line_number: int,
    label: str,
) -> None:
    bucket.append(
        {
            **line_record(path, root, line_number),
            "label": label,
        }
    )


def extract_event_lineage(root: Path) -> dict[str, Any]:
    lineage: dict[str, Any] = {
        "schemaVersion": "1.0",
        "scannerVersion": SCANNER_VERSION,
        "registryReferences": [],
        "emitters": [],
        "serverValidationGates": [],
        "trustBoundaries": [],
        "onboardingRouting": [],
        "robloxAnalyticsCalls": [],
        "notes": [
            "Lineage records contain paths, line numbers, and labels only; source snippets and player telemetry are intentionally excluded.",
            "Repository evidence proves source-level governance surfaces, not live Creator Dashboard values.",
        ],
    }

    for path in iter_text_files(root):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        for line_number, line in enumerate(text.splitlines(), start=1):
            if ANALYTIC_SAFE_PATH.search(line):
                append_lineage_record(
                    lineage["registryReferences"],
                    path,
                    root,
                    line_number,
                    "analytics-safe-path-registry",
                )
            if ANALYTICS_TYPE_DATA.search(line):
                append_lineage_record(
                    lineage["emitters"],
                    path,
                    root,
                    line_number,
                    "analytics-type-data-construction",
                )
            if QUEUE_VALIDATION.search(line) and "Analytics" in path.as_posix():
                append_lineage_record(
                    lineage["serverValidationGates"],
                    path,
                    root,
                    line_number,
                    "analytics-queue-validation",
                )
            if TRUST_BOUNDARY.search(line) and (
                "Network" in path.as_posix()
                or "Communicator" in path.as_posix()
                or "Analytics" in path.as_posix()
            ):
                append_lineage_record(
                    lineage["trustBoundaries"],
                    path,
                    root,
                    line_number,
                    "client-server-trust-boundary",
                )
            if ONBOARDING_ROUTING.search(line) and "Analytics" in path.as_posix():
                append_lineage_record(
                    lineage["onboardingRouting"],
                    path,
                    root,
                    line_number,
                    "onboarding-miscellaneous-funnel-routing",
                )
            if ANALYTICS_CALL.search(line):
                append_lineage_record(
                    lineage["robloxAnalyticsCalls"],
                    path,
                    root,
                    line_number,
                    "roblox-analytics-service-call-or-wrapper",
                )

    stable_lineage = json.dumps(lineage, sort_keys=True, separators=(",", ":"))
    lineage["schemaHash"] = hashlib.sha256(stable_lineage.encode("utf-8")).hexdigest()
    return lineage


def scan(root: Path, association_file: Path | None = None) -> dict[str, Any]:
    matches: dict[str, list[dict[str, Any]]] = {
        name: [] for name in PATTERNS
    }
    secret_indicators: list[dict[str, Any]] = []
    evidence_files: dict[str, str] = {}
    text_files_scanned = 0

    for path in iter_text_files(root):
        text_files_scanned += 1
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
    actionable_secret_count = count_actionable_secret_indicators(secret_indicators)
    runtime_cookie_count = count_runtime(matches["roblox_cookie"])
    runtime_windows_path_count = count_runtime(matches["absolute_windows_path"])
    runtime_destructive_file_count = count_runtime(matches["destructive_file_operation"])
    if actionable_secret_count:
        findings.append(
            {
                "ruleId": "RBX-CRED-001",
                "severity": "critical",
                "summary": "Potential literal credential assignments were detected.",
                "evidenceCount": actionable_secret_count,
            }
        )
    if runtime_cookie_count:
        findings.append(
            {
                "ruleId": "RBX-CRED-002",
                "severity": "critical",
                "summary": "Roblox session cookie marker references were found in runtime code.",
                "evidenceCount": runtime_cookie_count,
            }
        )
    elif matches["roblox_cookie"]:
        findings.append(
            {
                "ruleId": "RBX-CRED-002-DOC",
                "severity": "informational",
                "summary": "Roblox session cookie marker references were limited to docs, tests, or placeholders.",
                "evidenceCount": len(matches["roblox_cookie"]),
            }
        )
    if runtime_windows_path_count:
        findings.append(
            {
                "ruleId": "RBX-RELEASE-001",
                "severity": "medium",
                "summary": "Hard-coded absolute Windows paths reduce portability and provenance.",
                "evidenceCount": runtime_windows_path_count,
            }
        )
    elif matches["absolute_windows_path"]:
        findings.append(
            {
                "ruleId": "RBX-RELEASE-001-DOC",
                "severity": "informational",
                "summary": "Absolute Windows paths were limited to docs, tests, or placeholders.",
                "evidenceCount": len(matches["absolute_windows_path"]),
            }
        )
    if runtime_destructive_file_count:
        findings.append(
            {
                "ruleId": "RBX-REPO-001",
                "severity": "medium",
                "summary": "Destructive file operations require root confinement and journaling.",
                "evidenceCount": runtime_destructive_file_count,
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

    event_lineage = extract_event_lineage(root)
    association = load_public_association(root, association_file)
    redaction_audit = {
        "passed": True,
        "sourceSnippetsCollected": False,
        "playerLevelTelemetryCollected": False,
        "credentialValuesCollected": False,
        "secretValuesRedacted": len(secret_indicators),
        "notes": [
            "Evidence records omit source snippets and raw telemetry payloads.",
            "Credential-looking assignment values are replaced with <redacted>.",
        ],
    }

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
            "textFilesScanned": text_files_scanned,
            "ignoredDirectories": sorted(IGNORED_DIRS),
            "ignoredFiles": sorted(IGNORED_FILES),
            "liveRobloxTelemetryCollected": False,
            "credentialValuesCollected": False,
            "sourceSnippetsCollected": False,
        },
        "association": association,
        "schemaHash": event_lineage["schemaHash"],
        "inventory": {
            name: {"count": len(records), "locations": records}
            for name, records in matches.items()
        },
        "eventLineageSummary": {
            key: len(value)
            for key, value in event_lineage.items()
            if isinstance(value, list)
        },
        "secretIndicators": secret_indicators,
        "redactionAudit": redaction_audit,
        "evidenceFiles": evidence_files,
        "findings": findings,
    }


def build_manifest(scan_result: dict[str, Any]) -> dict[str, Any]:
    repository = scan_result["repository"]
    association = scan_result.get("association")
    return {
        "schemaVersion": "1.0",
        "scannerVersion": SCANNER_VERSION,
        "generatedAt": scan_result["collectedAt"],
        "repository": repository,
        "association": association,
        "schemaHash": scan_result["schemaHash"],
        "privacy": {
            "privateSourceCodeMirrored": False,
            "sourceSnippetsCollected": False,
            "playerLevelTelemetryCollected": False,
            "credentialValuesCollected": False,
        },
        "artifacts": [
            "manifest.json",
            "repository-scan.json",
            "event-lineage.json",
            "findings.json",
            "report.md",
            "checksums.sha256",
        ],
    }


def build_report(scan_result: dict[str, Any]) -> str:
    repository = scan_result["repository"]
    coverage = scan_result["coverage"]
    findings = scan_result["findings"]
    association = scan_result.get("association") or {}
    public_adapter = association.get("public_adapter", {}).get("repository", "unknown")
    private_source = association.get("private_game_source", {}).get(
        "repository", "unknown"
    )
    finding_lines = [
        f"- {finding['severity']}: {finding['ruleId']} - {finding['summary']} "
        f"({finding['evidenceCount']} records)"
        for finding in findings
    ] or ["- No actionable findings from repository evidence."]

    return "\n".join(
        [
            "# Roblox Telemetry Governance Evidence",
            "",
            f"- Repository: {repository.get('remote') or repository.get('path')}",
            f"- Commit: {repository.get('commit') or 'unknown'}",
            f"- Dirty worktree: {repository.get('dirty')}",
            f"- Scanner version: {SCANNER_VERSION}",
            f"- Schema hash: {scan_result['schemaHash']}",
            f"- Text files scanned: {coverage['textFilesScanned']}",
            f"- Public adapter: {public_adapter}",
            f"- Private source: {private_source}",
            "",
            "## Privacy Boundary",
            "",
            "- Source snippets are not collected.",
            "- Player-level telemetry is not collected.",
            "- Credential-looking values are redacted.",
            "- Repository evidence does not prove live Roblox dashboard values.",
            "",
            "## Findings",
            "",
            *finding_lines,
            "",
        ]
    )


def write_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_evidence_package(
    root: Path,
    evidence_dir: Path,
    association_file: Path | None = None,
) -> dict[str, Any]:
    result = scan(root, association_file)
    event_lineage = extract_event_lineage(root)
    manifest = build_manifest(result)
    findings_payload = {
        "schemaVersion": "1.0",
        "scannerVersion": SCANNER_VERSION,
        "findings": result["findings"],
        "redactionAudit": result["redactionAudit"],
    }

    evidence_dir.mkdir(parents=True, exist_ok=True)
    artifacts: dict[str, str] = {
        "manifest.json": "",
        "repository-scan.json": "",
        "event-lineage.json": "",
        "findings.json": "",
        "report.md": "",
    }

    write_json(evidence_dir / "manifest.json", manifest)
    write_json(evidence_dir / "repository-scan.json", result)
    write_json(evidence_dir / "event-lineage.json", event_lineage)
    write_json(evidence_dir / "findings.json", findings_payload)
    (evidence_dir / "report.md").write_text(build_report(result), encoding="utf-8")

    for name in artifacts:
        artifacts[name] = sha256(evidence_dir / name)

    checksums = "".join(f"{digest}  {name}\n" for name, digest in sorted(artifacts.items()))
    (evidence_dir / "checksums.sha256").write_text(checksums, encoding="utf-8")
    artifacts["checksums.sha256"] = sha256(evidence_dir / "checksums.sha256")

    return {
        "evidenceDir": str(evidence_dir),
        "manifest": manifest,
        "checksums": artifacts,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("repository", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--evidence-dir", type=Path)
    parser.add_argument("--association-file", type=Path)
    args = parser.parse_args()

    root = args.repository.resolve()
    if not root.is_dir():
        parser.error(f"repository is not a directory: {root}")

    if args.evidence_dir:
        result = write_evidence_package(
            root,
            args.evidence_dir.resolve(),
            args.association_file.resolve() if args.association_file else None,
        )
    else:
        result = scan(
            root,
            args.association_file.resolve() if args.association_file else None,
        )
    encoded = json.dumps(result, indent=2, sort_keys=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded + "\n", encoding="utf-8")
    else:
        print(encoded)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
