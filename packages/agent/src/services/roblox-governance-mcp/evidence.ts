import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SERVICE_DIR, "../../../../..");
export const DEFAULT_EVIDENCE_ROOT = resolve(
  REPO_ROOT,
  ".doolittle/governance/roblox",
);

export function getEvidenceRoot(): string {
  return (
    process.env.DOOLITTLE_ROBLOX_GOVERNANCE_EVIDENCE_ROOT?.trim() ||
    DEFAULT_EVIDENCE_ROOT
  );
}

export function readJsonFile(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readPublicAssociation(
  repoRoot = REPO_ROOT,
): Record<string, unknown> {
  return (
    readJsonFile(resolve(repoRoot, "public-association.json")) ?? {
      schema_version: 1,
      relationship: "public_mcp_oauth_adapter_for_private_roblox_game_source",
      public_adapter: { repository: "RobGonWin/doolittle" },
      private_game_source: { repository: "RobGonWin/1v1-edit-arena" },
      mcp: {
        public_https_endpoint: null,
        expected_path: "/mcp",
        authentication: "Mixed OAuth",
      },
      privacy: {
        private_source_code_is_mirrored: false,
        secrets_are_included: false,
      },
    }
  );
}

export function resolveEvidenceAssociation(
  manifest: unknown,
  repositoryScan: unknown,
): Record<string, unknown> {
  const manifestAssociation =
    manifest && typeof manifest === "object"
      ? (manifest as Record<string, unknown>).association
      : null;
  if (manifestAssociation && typeof manifestAssociation === "object") {
    return {
      source: "evidence-manifest",
      value: manifestAssociation as Record<string, unknown>,
    };
  }

  const scanAssociation =
    repositoryScan && typeof repositoryScan === "object"
      ? (repositoryScan as Record<string, unknown>).association
      : null;
  if (scanAssociation && typeof scanAssociation === "object") {
    return {
      source: "repository-scan",
      value: scanAssociation as Record<string, unknown>,
    };
  }

  return {
    source: "public-association-fallback",
    value: readPublicAssociation(),
  };
}

export interface EvidencePackagePaths {
  directory: string;
  manifest: string;
  repositoryScan: string;
  eventLineage: string;
  findings: string;
}

export function findLatestEvidencePackage(
  evidenceRoot = getEvidenceRoot(),
): EvidencePackagePaths | null {
  if (!existsSync(evidenceRoot)) {
    return null;
  }

  const candidates = readdirSync(evidenceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(evidenceRoot, entry.name))
    .filter((directory) => existsSync(resolve(directory, "manifest.json")))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  const directory = candidates[0];
  if (!directory) {
    return null;
  }

  return {
    directory,
    manifest: resolve(directory, "manifest.json"),
    repositoryScan: resolve(directory, "repository-scan.json"),
    eventLineage: resolve(directory, "event-lineage.json"),
    findings: resolve(directory, "findings.json"),
  };
}

export function readLatestEvidencePackage(evidenceRoot = getEvidenceRoot()) {
  const paths = findLatestEvidencePackage(evidenceRoot);
  if (!paths) {
    return {
      available: false,
      paths: null,
      manifest: null,
      repositoryScan: null,
      eventLineage: null,
      findings: null,
    };
  }

  return {
    available: true,
    paths,
    manifest: readJsonFile(paths.manifest),
    repositoryScan: readJsonFile(paths.repositoryScan),
    eventLineage: readJsonFile(paths.eventLineage),
    findings: readJsonFile(paths.findings),
  };
}

export function sanitizeRepository(
  repository: unknown,
): Record<string, unknown> {
  if (!repository || typeof repository !== "object") {
    return {};
  }
  const value = repository as Record<string, unknown>;
  return {
    remote: value.remote ?? null,
    commit: value.commit ?? null,
    dirty: value.dirty ?? null,
  };
}

export function sanitizeCoverage(coverage: unknown): Record<string, unknown> {
  if (!coverage || typeof coverage !== "object") {
    return {};
  }
  const value = coverage as Record<string, unknown>;
  return {
    textFilesScanned: Number(value.textFilesScanned ?? 0),
    ignoredDirectoryCount: Array.isArray(value.ignoredDirectories)
      ? value.ignoredDirectories.length
      : 0,
    ignoredFilePolicyCount: Array.isArray(value.ignoredFiles)
      ? value.ignoredFiles.length
      : 0,
    liveRobloxTelemetryCollected: value.liveRobloxTelemetryCollected === true,
    credentialValuesCollected: value.credentialValuesCollected === true,
    sourceSnippetsCollected: value.sourceSnippetsCollected === true,
  };
}

export function countInventory(inventory: unknown): Record<string, number> {
  if (!inventory || typeof inventory !== "object") {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(inventory)) {
    if (value && typeof value === "object" && "count" in value) {
      counts[key] = Number((value as { count?: unknown }).count ?? 0);
    }
  }
  return counts;
}
