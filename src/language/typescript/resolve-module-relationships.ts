import { dirname, posix } from "node:path";
import type { SemanticEntity } from "../../model/entity.js";
import type { SemanticEvidence } from "../../model/evidence.js";
import type { SemanticRelationship } from "../../model/relationship.js";
import type { SourceFileRecord } from "../../model/project.js";
import type { ExportRecord, ImportRecord } from "./extract-entities.js";

export interface FileExtractionSummary {
  file: SourceFileRecord;
  moduleId: string;
  entities: SemanticEntity[];
  importRecords: ImportRecord[];
  exportRecords: ExportRecord[];
}

export interface ModuleRelationshipsResult {
  relationships: SemanticRelationship[];
  evidence: SemanticEvidence[];
}

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs", ".cjs"];

/**
 * TS ESM specifiers conventionally reference the compiled ".js" output
 * even though the source is ".ts"/".tsx". Map each such suffix to the
 * source extensions it may actually resolve to.
 */
const JS_SPECIFIER_TO_SOURCE_EXTENSIONS: Record<string, string[]> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

export function resolveModuleRelationships(
  summaries: FileExtractionSummary[],
): ModuleRelationshipsResult {
  const knownPaths = new Set(summaries.map((summary) => summary.file.relativePath));
  const relationshipsById = new Map<string, SemanticRelationship>();
  const evidence: SemanticEvidence[] = [];

  for (const summary of summaries) {
    const fileDir = dirname(summary.file.relativePath);
    const entityByName = new Map<string, string>();
    for (const entity of summary.entities) {
      if (entity.parentId === summary.moduleId && entity.name) {
        entityByName.set(entity.name, entity.id);
      }
    }

    for (const importRecord of summary.importRecords) {
      const resolvedPath = resolveRelativeSpecifier(importRecord.specifier, fileDir, knownPaths);
      addRelationship(
        relationshipsById,
        evidence,
        "imports",
        summary.moduleId,
        resolvedPath,
        importRecord.specifier,
        importRecord.location,
      );
    }

    for (const exportRecord of summary.exportRecords) {
      if (exportRecord.kind === "reExport") {
        const resolvedPath = resolveRelativeSpecifier(exportRecord.specifier, fileDir, knownPaths);
        addRelationship(
          relationshipsById,
          evidence,
          "reExports",
          summary.moduleId,
          resolvedPath,
          exportRecord.exportedName ?? exportRecord.specifier,
          exportRecord.location,
        );
      } else if (exportRecord.kind === "local") {
        const targetId = entityByName.get(exportRecord.exportedName);
        addRelationship(
          relationshipsById,
          evidence,
          "exports",
          summary.moduleId,
          targetId,
          exportRecord.exportedName,
          exportRecord.location,
        );
      } else {
        addRelationship(
          relationshipsById,
          evidence,
          "exports",
          summary.moduleId,
          undefined,
          "default",
          exportRecord.location,
        );
      }
    }

    for (const entity of summary.entities) {
      if (
        entity.parentId === summary.moduleId &&
        entity.flags.exported &&
        entity.kind !== "importDeclaration" &&
        entity.kind !== "exportDeclaration"
      ) {
        addRelationship(
          relationshipsById,
          evidence,
          "exports",
          summary.moduleId,
          entity.id,
          entity.name ?? entity.id,
          entity.location,
        );
      }
    }
  }

  return { relationships: Array.from(relationshipsById.values()), evidence };
}

function addRelationship(
  relationshipsById: Map<string, SemanticRelationship>,
  evidence: SemanticEvidence[],
  kind: SemanticRelationship["kind"],
  sourceId: string,
  targetId: string | undefined,
  label: string,
  location: SemanticRelationship["location"],
): void {
  const targetDiscriminator = targetId ?? `unresolved:${label}`;
  const id = `relationship:${kind}:${sourceId}=>${targetDiscriminator}`;
  if (relationshipsById.has(id)) {
    return;
  }

  const evidenceId = `evidence:${id}`;
  evidence.push({
    id: evidenceId,
    type: "importBinding",
    subjectId: id,
    location,
    confidence: targetId ? 1 : 0.6,
    details: { label },
    explanation: targetId
      ? `Resolved ${kind} target from module specifier or export binding.`
      : `Unresolved ${kind} target "${label}"; likely an external package or alias.`,
  });

  relationshipsById.set(id, {
    id,
    sourceId,
    targetId,
    kind,
    location,
    confidence: targetId ? 1 : 0.6,
    evidenceIds: [evidenceId],
  });
}

function resolveRelativeSpecifier(
  specifier: string,
  fromDir: string,
  knownPaths: Set<string>,
): string | undefined {
  if (!specifier.startsWith(".")) {
    return undefined;
  }

  const normalizedBase = posix.normalize(posix.join(toPosix(fromDir), specifier));

  const candidates = [
    normalizedBase,
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${normalizedBase}${extension}`),
    ...RESOLVABLE_EXTENSIONS.map((extension) => posix.join(normalizedBase, `index${extension}`)),
  ];

  for (const [jsSuffix, sourceExtensions] of Object.entries(JS_SPECIFIER_TO_SOURCE_EXTENSIONS)) {
    if (normalizedBase.endsWith(jsSuffix)) {
      const withoutSuffix = normalizedBase.slice(0, -jsSuffix.length);
      for (const sourceExtension of sourceExtensions) {
        candidates.push(`${withoutSuffix}${sourceExtension}`);
      }
    }
  }

  return candidates.find((candidate) => knownPaths.has(candidate));
}

function toPosix(inputPath: string): string {
  return inputPath === "." ? "" : inputPath.split("\\").join("/");
}
