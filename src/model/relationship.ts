import type { SourceLocation } from "./entity.js";

export type RelationshipKind = "contains" | "imports" | "exports" | "reExports";

export interface SemanticRelationship {
  id: string;
  sourceId: string;
  targetId?: string;
  candidateTargetIds?: string[];
  kind: RelationshipKind;
  location?: SourceLocation;
  confidence: number;
  evidenceIds: string[];
}
