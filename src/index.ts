export { analyzeProject, SCHEMA_VERSION, ENGINE_VERSION } from "./application/analyze-project.js";
export { CodaraInvocationError } from "./shared/errors.js";

export type {
  AnalyzeProjectOptions,
  AnalysisMode,
  AnalysisSession,
  AnalysisRunSummary,
  CodaraAnalysisResult,
  Phase1Metrics,
  ProjectSummary,
  ResourceBudget,
} from "./model/analysis-result.js";

export type {
  FileClassification,
  ModuleSystem,
  ProjectBoundary,
  ProjectBoundaryKind,
  ProjectCapabilities,
  ProjectConfiguration,
  ProjectIdentity,
  ProjectModel,
  SourceFileRecord,
  SourceLanguage,
  TypeScriptConfigSignal,
} from "./model/project.js";

export type {
  EntityFlags,
  EntityVisibility,
  SemanticEntity,
  SemanticEntityKind,
  SemanticRole,
  SourceLocation,
  SourcePosition,
} from "./model/entity.js";

export type { RelationshipKind, SemanticRelationship } from "./model/relationship.js";
export type { SemanticEvidence, SemanticEvidenceType } from "./model/evidence.js";
export type { Diagnostic, DiagnosticSeverity } from "./model/diagnostic.js";

export type {
  BehaviorKind,
  Condition,
  Effect,
  Outcome,
  SemanticBehavior,
} from "./model/behavior.js";

export type {
  ContextBundle,
  ContextFacet,
  ContextRequest,
  EntitySelector,
  QueryFilter,
  RankedEntity,
  RelationshipSelector,
  SemanticFact,
  SemanticQuery,
  SourceRangeReference,
} from "./model/query.js";
