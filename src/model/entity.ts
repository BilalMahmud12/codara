export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceLocation {
  filePath: string;
  start: SourcePosition;
  end: SourcePosition;
}

export type SemanticEntityKind =
  | "module"
  | "class"
  | "interface"
  | "typeAlias"
  | "enum"
  | "constructor"
  | "method"
  | "getter"
  | "setter"
  | "functionDeclaration"
  | "arrowFunction"
  | "functionExpression"
  | "objectMethod"
  | "variable"
  | "importDeclaration"
  | "exportDeclaration";

export type EntityVisibility = "public" | "private" | "protected";

export interface EntityFlags {
  exported: boolean;
  async: boolean;
  static: boolean;
  abstract: boolean;
  readonly: boolean;
  generator: boolean;
  visibility?: EntityVisibility;
}

/**
 * Semantic roles are reserved for future framework-aware enrichment
 * (e.g. "http-endpoint"). Phase 1 does not populate this array.
 */
export type SemanticRole = string;

export interface SemanticEntity {
  id: string;
  projectId: string;
  fileId: string;
  kind: SemanticEntityKind;
  name?: string;
  qualifiedName?: string;
  parentId?: string;
  location: SourceLocation;
  flags: EntityFlags;
  roles: SemanticRole[];
  confidence: number;
  evidenceIds: string[];
}
