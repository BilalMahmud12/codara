/**
 * Deterministic identity generation, isolated behind this module so a
 * future scheme (e.g. git-aware rename tracking or content fingerprints)
 * can replace it without touching callers.
 *
 * Phase 1 identity is purely structural:
 *   project-relative path + entity hierarchy + declaration kind + signature discriminator
 */

export interface EntityIdSegment {
  kind: string;
  discriminator: string;
}

export function createProjectId(name: string | undefined, version: string | undefined): string {
  if (name) {
    return version ? `project:${name}@${version}` : `project:${name}`;
  }
  return "project:root";
}

export function createFileId(relativePath: string): string {
  return `file:${relativePath}`;
}

/**
 * Builds an entity ID from the owning file's relative path and the
 * chain of ancestor segments from outermost to innermost.
 */
export function createEntityId(relativePath: string, segments: EntityIdSegment[]): string {
  const chain = segments.map((segment) => `${segment.kind}:${segment.discriminator}`).join("::");
  return chain.length > 0 ? `${relativePath}::${chain}` : relativePath;
}

/**
 * Position-based discriminator for entities without a stable name
 * (anonymous arrow functions, anonymous function expressions).
 */
export function positionDiscriminator(line: number, column: number): string {
  return `@${line}:${column}`;
}
