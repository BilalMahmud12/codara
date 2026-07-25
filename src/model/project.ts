import type { Diagnostic } from "./diagnostic.js";

export type ModuleSystem = "commonjs" | "esm" | "unknown";

export interface ProjectIdentity {
  name?: string;
  version?: string;
  packageManager?: "npm" | "yarn" | "pnpm" | "bun" | "unknown";
  moduleSystem: ModuleSystem;
}

export type ProjectBoundaryKind = "workspaceRoot" | "packageRoot" | "sourceRoot" | "testRoot";

export interface ProjectBoundary {
  kind: ProjectBoundaryKind;
  relativePath: string;
}

export interface TypeScriptConfigSignal {
  configPath: string;
  allowJs: boolean;
  checkJs: boolean;
  jsx?: string;
  module?: string;
  moduleResolution?: string;
  target?: string;
  sourceMap: boolean;
  paths?: Record<string, string[]>;
  baseUrl?: string;
  projectReferences: string[];
  include?: string[];
  exclude?: string[];
}

export interface ProjectConfiguration {
  packageManifestPath?: string;
  typeScriptConfig?: TypeScriptConfigSignal;
  workspacePatterns?: string[];
  scripts?: Record<string, string>;
  dependencies?: string[];
  devDependencies?: string[];
}

export interface ProjectCapabilities {
  syntaxAnalysis: boolean;
  typeAnalysis: boolean;
  symbolResolution: boolean;
  sourceMaps: boolean;
  workspaceDetected: boolean;
}

export type FileClassification =
  | "productionSource"
  | "testSource"
  | "configuration"
  | "declaration"
  | "generated"
  | "buildOutput"
  | "fixture"
  | "script"
  | "unknown";

export type SourceLanguage = "js" | "jsx" | "ts" | "tsx";

export interface SourceFileRecord {
  id: string;
  projectId: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  classification: FileClassification;
  language?: SourceLanguage;
  shouldParse: boolean;
  exclusionReason?: string;
}

export interface ProjectModel {
  id: string;
  rootPath: string;
  identity: ProjectIdentity;
  boundaries: ProjectBoundary[];
  configuration: ProjectConfiguration;
  capabilities: ProjectCapabilities;
  files: SourceFileRecord[];
  diagnostics: Diagnostic[];
}
