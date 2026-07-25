import type { SemanticEntity } from "./entity.js";
import type { RelationshipKind } from "./relationship.js";
import type { Diagnostic } from "./diagnostic.js";

/**
 * The Query/Context Model is a documented seam for a later phase.
 * Phase 1 does not implement query execution or context compilation;
 * these types exist so the public API surface will not need a
 * breaking redesign when that work begins.
 */
export interface EntitySelector {
  id?: string;
  name?: string;
  kind?: string;
}

export interface RelationshipSelector {
  kind: RelationshipKind;
  direction?: "incoming" | "outgoing";
}

export interface QueryFilter {
  field: string;
  value: unknown;
}

export interface SemanticQuery {
  entity?: EntitySelector;
  relationships?: RelationshipSelector[];
  depth?: number;
  filters?: QueryFilter[];
}

export type ContextFacet = "entities" | "relationships" | "evidence" | "sourceRanges";

export interface ContextRequest {
  task: string;
  tokenBudget: number;
  include: ContextFacet[];
}

export interface RankedEntity {
  entity: SemanticEntity;
  rank: number;
}

export interface SemanticFact {
  description: string;
}

export interface SourceRangeReference {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface ContextBundle {
  primaryEntities: SemanticEntity[];
  relatedEntities: RankedEntity[];
  facts: SemanticFact[];
  sourceRanges: SourceRangeReference[];
  diagnostics: Diagnostic[];
  estimatedTokens: number;
}
