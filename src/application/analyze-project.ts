import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { CodaraInvocationError } from "../shared/errors.js";
import { createProjectId } from "../identity/entity-id.js";
import { inspectRoot } from "../discovery/inspect-root.js";
import { readManifest } from "../discovery/read-manifest.js";
import { resolveConfiguration } from "../discovery/resolve-configuration.js";
import { detectBoundaries } from "../discovery/detect-boundaries.js";
import { inventoryFiles } from "../discovery/inventory-files.js";
import { createProgram } from "../language/typescript/create-program.js";
import { extractEntitiesForFile } from "../language/typescript/extract-entities.js";
import { toSyntaxDiagnostics } from "../language/typescript/syntax-diagnostics.js";
import {
  resolveModuleRelationships,
  type FileExtractionSummary,
} from "../language/typescript/resolve-module-relationships.js";
import { normalizeResult } from "../output/normalize-result.js";
import { writeAnalysisJson } from "../output/write-json.js";
import type {
  AnalyzeProjectOptions,
  CodaraAnalysisResult,
  ResourceBudget,
} from "../model/analysis-result.js";
import type { Diagnostic } from "../model/diagnostic.js";
import type { SemanticEntity } from "../model/entity.js";
import type { SemanticEvidence } from "../model/evidence.js";
import type { SemanticRelationship } from "../model/relationship.js";

export const SCHEMA_VERSION = "1.0.0";
export const ENGINE_VERSION = "0.1.0";

const DEFAULT_OUTPUT_FILE = ".codara/analysis.json";

export async function analyzeProject(
  options: AnalyzeProjectOptions,
): Promise<CodaraAnalysisResult> {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const runId = randomUUID();

  const rootPath = resolve(options.root);
  await validateRoot(rootPath);

  const resourceBudget: ResourceBudget = { ...options.resourceBudget };

  const [reconnaissance, manifestResult, configuration] = await Promise.all([
    inspectRoot(rootPath),
    readManifest(rootPath),
    Promise.resolve(resolveConfiguration(rootPath)),
  ]);

  const workspacePatterns = manifestResult.manifest?.workspacePatterns ?? [];
  const boundaryResult = await detectBoundaries(rootPath, reconnaissance, workspacePatterns);

  const projectId = createProjectId(
    manifestResult.manifest?.name,
    manifestResult.manifest?.version,
  );

  const inventoryResult = await inventoryFiles(rootPath, projectId, {
    include: options.include,
    exclude: options.exclude,
    maxFileSizeBytes: resourceBudget.maxFileSizeBytes,
    maxFiles: resourceBudget.maxFiles,
  });

  const diagnostics: Diagnostic[] = [
    ...manifestResult.diagnostics,
    ...configuration.diagnostics,
    ...inventoryResult.diagnostics,
  ];

  const parseableFiles = inventoryResult.files.filter((file) => file.shouldParse && file.language);
  const absolutePathByRelativePath = new Map(
    parseableFiles.map((file) => [file.relativePath, join(rootPath, file.relativePath)]),
  );

  const program =
    parseableFiles.length > 0
      ? createProgram(
          Array.from(absolutePathByRelativePath.values()),
          configuration.compilerOptions,
        )
      : undefined;

  const entities: SemanticEntity[] = [];
  const relationships: SemanticRelationship[] = [];
  const evidence: SemanticEvidence[] = [];
  const fileSummaries: FileExtractionSummary[] = [];

  for (const file of parseableFiles) {
    const absolutePath = absolutePathByRelativePath.get(file.relativePath)!;
    const sourceFile = program?.getSourceFile(absolutePath);

    if (!sourceFile) {
      diagnostics.push({
        code: "file-not-parsed",
        severity: "warning",
        message: "The TypeScript compiler could not load this file.",
        filePath: file.relativePath,
        recoverable: true,
      });
      continue;
    }

    const syntacticDiagnostics = program!.getSyntacticDiagnostics(sourceFile);
    diagnostics.push(...toSyntaxDiagnostics(sourceFile, syntacticDiagnostics, file.relativePath));

    const extraction = extractEntitiesForFile(sourceFile, file.relativePath, projectId, file.id);
    entities.push(...extraction.entities);
    relationships.push(...extraction.relationships);
    evidence.push(...extraction.evidence);
    diagnostics.push(...extraction.diagnostics);

    fileSummaries.push({
      file,
      moduleId: file.relativePath,
      entities: extraction.entities,
      importRecords: extraction.importRecords,
      exportRecords: extraction.exportRecords,
    });
  }

  const moduleRelationships = resolveModuleRelationships(fileSummaries);
  relationships.push(...moduleRelationships.relationships);
  evidence.push(...moduleRelationships.evidence);

  const normalized = normalizeResult({
    files: inventoryResult.files,
    entities,
    relationships,
    evidence,
    diagnostics,
  });

  const finishedAt = new Date().toISOString();

  const result: CodaraAnalysisResult = {
    schemaVersion: SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    run: {
      runId,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedAtMs,
      mode: "standard",
    },
    project: {
      id: projectId,
      rootPath: ".",
      name: manifestResult.manifest?.name,
      version: manifestResult.manifest?.version,
      moduleSystem: manifestResult.manifest?.moduleSystem ?? "unknown",
      capabilities: {
        syntaxAnalysis: true,
        typeAnalysis: Boolean(configuration.signal),
        symbolResolution: false,
        sourceMaps: Boolean(configuration.signal?.sourceMap),
        workspaceDetected: boundaryResult.workspaceDetected,
      },
      identity: {
        name: manifestResult.manifest?.name,
        version: manifestResult.manifest?.version,
        packageManager: reconnaissance.packageManager,
        moduleSystem: manifestResult.manifest?.moduleSystem ?? "unknown",
      },
      workspaceMemberCandidates: boundaryResult.workspaceMemberCandidates,
    },
    ...normalized,
  };

  if (options.outputFile !== false) {
    await writeAnalysisJson(rootPath, options.outputFile ?? DEFAULT_OUTPUT_FILE, result);
  }

  return result;
}

async function validateRoot(rootPath: string): Promise<void> {
  if (!isAbsolute(rootPath)) {
    throw new CodaraInvocationError(
      "invalid-root",
      `Resolved root path is not absolute: ${rootPath}`,
    );
  }
  let stats;
  try {
    stats = await stat(rootPath);
  } catch {
    throw new CodaraInvocationError("root-not-found", `Analysis root does not exist: ${rootPath}`);
  }
  if (!stats.isDirectory()) {
    throw new CodaraInvocationError(
      "root-not-directory",
      `Analysis root is not a directory: ${rootPath}`,
    );
  }
}
