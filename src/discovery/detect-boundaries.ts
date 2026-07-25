import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ProjectBoundary } from "../model/project.js";
import type { RootReconnaissance } from "./inspect-root.js";

export interface BoundaryDetectionResult {
  boundaries: ProjectBoundary[];
  workspaceDetected: boolean;
  workspaceMemberCandidates: string[];
}

/**
 * Phase 1 supports a single-package root robustly and reports
 * workspace member candidates as a signal only. Full multi-package
 * semantic resolution is a later phase.
 */
export async function detectBoundaries(
  rootPath: string,
  reconnaissance: RootReconnaissance,
  workspacePatterns: string[],
): Promise<BoundaryDetectionResult> {
  const boundaries: ProjectBoundary[] = [];
  const workspaceDetected = workspacePatterns.length > 0;

  boundaries.push({ kind: "packageRoot", relativePath: "." });
  if (workspaceDetected) {
    boundaries.push({ kind: "workspaceRoot", relativePath: "." });
  }

  for (const directoryName of reconnaissance.notableDirectories) {
    if (directoryName === "src" || directoryName === "lib" || directoryName === "app") {
      boundaries.push({ kind: "sourceRoot", relativePath: directoryName });
    }
    if (directoryName === "test" || directoryName === "tests") {
      boundaries.push({ kind: "testRoot", relativePath: directoryName });
    }
  }

  const workspaceMemberCandidates = workspaceDetected
    ? await expandWorkspacePatterns(rootPath, workspacePatterns)
    : [];

  return { boundaries, workspaceDetected, workspaceMemberCandidates };
}

async function expandWorkspacePatterns(rootPath: string, patterns: string[]): Promise<string[]> {
  const candidates = new Set<string>();

  for (const pattern of patterns) {
    const wildcardIndex = pattern.indexOf("*");
    if (wildcardIndex === -1) {
      candidates.add(pattern);
      continue;
    }

    const staticPrefix = pattern.slice(0, wildcardIndex).replace(/\/$/, "");
    const parentDir = join(rootPath, staticPrefix);

    try {
      const entries = await readdir(parentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          candidates.add(staticPrefix ? `${staticPrefix}/${entry.name}` : entry.name);
        }
      }
    } catch {
      // Pattern's static prefix does not resolve to a readable directory; skip.
    }
  }

  return Array.from(candidates).sort();
}
