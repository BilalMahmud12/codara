import type { Diagnostic } from "./diagnostic.js";
import type { SemanticEntity } from "./entity.js";
import type { SemanticEvidence } from "./evidence.js";
import type { SemanticRelationship } from "./relationship.js";
import type {
  ModuleSystem,
  ProjectCapabilities,
  ProjectIdentity,
  SourceFileRecord,
} from "./project.js";

export type AnalysisMode = "fast" | "standard" | "deep";

export interface ResourceBudget {
  maxMemoryMb?: number;
  maxWorkers?: number;
  maxFileSizeBytes?: number;
  maxFiles?: number;
}

export interface AnalysisSession {
  runId: string;
  rootPath: string;
  mode: AnalysisMode;
  startedAt: string;
  resourceBudget: ResourceBudget;
}

export interface AnalyzeProjectOptions {
  root: string;
  outputFile?: string | false;
  include?: string[];
  exclude?: string[];
  resourceBudget?: Partial<ResourceBudget>;
}

/**
 * Volatile, run-specific metadata. Two runs over identical source and
 * configuration may legitimately differ here (timestamps, duration,
 * run identifiers) even when the semantic output is equivalent.
 */
export interface AnalysisRunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  mode: AnalysisMode;
}

export interface ProjectSummary {
  id: string;
  rootPath: string;
  name?: string;
  version?: string;
  moduleSystem: ModuleSystem;
  capabilities: ProjectCapabilities;
  identity: ProjectIdentity;
  workspaceMemberCandidates: string[];
}

export interface Phase1Metrics {
  filesDiscovered: number;
  filesAnalyzed: number;
  filesSkipped: number;
  productionFiles: number;
  probableTestFiles: number;
  entityCountsByKind: Record<string, number>;
  relationshipCountsByKind: Record<string, number>;
  diagnosticCounts: {
    error: number;
    warning: number;
    info: number;
  };
}

export interface CodaraAnalysisResult {
  schemaVersion: string;
  engineVersion: string;
  run: AnalysisRunSummary;
  project: ProjectSummary;
  files: SourceFileRecord[];
  entities: SemanticEntity[];
  relationships: SemanticRelationship[];
  evidence: SemanticEvidence[];
  diagnostics: Diagnostic[];
  metrics: Phase1Metrics;
}
