import type { Diagnostic } from "../model/diagnostic.js";
import type { SemanticEntity } from "../model/entity.js";
import type { SemanticEvidence } from "../model/evidence.js";
import type { SemanticRelationship } from "../model/relationship.js";
import type { SourceFileRecord } from "../model/project.js";
import type { Phase1Metrics } from "../model/analysis-result.js";

export interface NormalizedSemanticOutput {
  files: SourceFileRecord[];
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  evidence: SemanticEvidence[];
  diagnostics: Diagnostic[];
  metrics: Phase1Metrics;
}

export interface NormalizeInput {
  files: SourceFileRecord[];
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  evidence: SemanticEvidence[];
  diagnostics: Diagnostic[];
}

/**
 * Sorts every semantic array deterministically and derives summary
 * metrics. Kept separate from run metadata so identical source and
 * configuration always normalize to equivalent output.
 */
export function normalizeResult(input: NormalizeInput): NormalizedSemanticOutput {
  const files = [...input.files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const entities = [...input.entities].sort((a, b) => a.id.localeCompare(b.id));
  const relationships = [...input.relationships].sort((a, b) => a.id.localeCompare(b.id));
  const evidence = [...input.evidence].sort((a, b) => a.id.localeCompare(b.id));
  const diagnostics = [...input.diagnostics].sort((a, b) => {
    const filePathCompare = (a.filePath ?? "").localeCompare(b.filePath ?? "");
    if (filePathCompare !== 0) return filePathCompare;
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    return a.message.localeCompare(b.message);
  });

  const metrics = computeMetrics(files, entities, relationships, diagnostics);

  return { files, entities, relationships, evidence, diagnostics, metrics };
}

function computeMetrics(
  files: SourceFileRecord[],
  entities: SemanticEntity[],
  relationships: SemanticRelationship[],
  diagnostics: Diagnostic[],
): Phase1Metrics {
  const entityCountsByKind: Record<string, number> = Object.create(null);
  for (const entity of entities) {
    entityCountsByKind[entity.kind] = (entityCountsByKind[entity.kind] ?? 0) + 1;
  }

  const relationshipCountsByKind: Record<string, number> = Object.create(null);
  for (const relationship of relationships) {
    relationshipCountsByKind[relationship.kind] =
      (relationshipCountsByKind[relationship.kind] ?? 0) + 1;
  }

  const diagnosticCounts = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) {
    diagnosticCounts[diagnostic.severity] += 1;
  }

  return {
    filesDiscovered: files.length,
    filesAnalyzed: files.filter((file) => file.shouldParse).length,
    filesSkipped: files.filter((file) => !file.shouldParse).length,
    productionFiles: files.filter((file) => file.classification === "productionSource").length,
    probableTestFiles: files.filter((file) => file.classification === "testSource").length,
    entityCountsByKind,
    relationshipCountsByKind,
    diagnosticCounts,
  };
}
