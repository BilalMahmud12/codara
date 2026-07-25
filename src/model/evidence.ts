import type { SourceLocation } from "./entity.js";

export type SemanticEvidenceType =
  | "manifestSignal"
  | "configurationSignal"
  | "syntaxDeclaration"
  | "importBinding"
  | "sourceRange"
  | "namingHeuristic";

export interface SemanticEvidence {
  id: string;
  type: SemanticEvidenceType;
  subjectId: string;
  location?: SourceLocation;
  confidence: number;
  details: Record<string, unknown>;
  explanation: string;
}
