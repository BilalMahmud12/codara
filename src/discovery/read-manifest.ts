import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Diagnostic } from "../model/diagnostic.js";
import type { ModuleSystem } from "../model/project.js";

export interface ManifestSignals {
  name?: string;
  version?: string;
  moduleSystem: ModuleSystem;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  workspacePatterns: string[];
  manifestRelativePath: string;
}

export interface ReadManifestResult {
  manifest?: ManifestSignals;
  diagnostics: Diagnostic[];
}

export async function readManifest(rootPath: string): Promise<ReadManifestResult> {
  const manifestPath = join(rootPath, "package.json");
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch {
    return { diagnostics: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      diagnostics: [
        {
          code: "manifest-parse-error",
          severity: "warning",
          message: `Failed to parse package.json: ${(error as Error).message}`,
          filePath: "package.json",
          recoverable: true,
        },
      ],
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      diagnostics: [
        {
          code: "manifest-invalid-shape",
          severity: "warning",
          message: "package.json does not contain a JSON object.",
          filePath: "package.json",
          recoverable: true,
        },
      ],
    };
  }

  const manifest = parsed as Record<string, unknown>;
  const moduleSystem: ModuleSystem =
    manifest.type === "module" ? "esm" : manifest.type === "commonjs" ? "commonjs" : "unknown";

  const workspaces = manifest.workspaces;
  let workspacePatterns: string[] = [];
  if (Array.isArray(workspaces)) {
    workspacePatterns = workspaces.filter((entry): entry is string => typeof entry === "string");
  } else if (
    typeof workspaces === "object" &&
    workspaces !== null &&
    Array.isArray((workspaces as { packages?: unknown }).packages)
  ) {
    workspacePatterns = (workspaces as { packages: unknown[] }).packages.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }

  return {
    manifest: {
      name: typeof manifest.name === "string" ? manifest.name : undefined,
      version: typeof manifest.version === "string" ? manifest.version : undefined,
      moduleSystem,
      scripts: isStringRecord(manifest.scripts) ? manifest.scripts : {},
      dependencies: isStringRecord(manifest.dependencies) ? Object.keys(manifest.dependencies) : [],
      devDependencies: isStringRecord(manifest.devDependencies)
        ? Object.keys(manifest.devDependencies)
        : [],
      workspacePatterns,
      manifestRelativePath: "package.json",
    },
    diagnostics: [],
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
