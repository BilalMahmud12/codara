import { existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import type { Diagnostic } from "../model/diagnostic.js";
import type { TypeScriptConfigSignal } from "../model/project.js";
import { toProjectRelativePath } from "../shared/paths.js";

export interface ResolvedConfiguration {
  signal?: TypeScriptConfigSignal;
  compilerOptions: ts.CompilerOptions;
  fileNames: string[];
  diagnostics: Diagnostic[];
}

const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  allowJs: true,
  checkJs: false,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  // Phase 1 selects its own file inventory; suppress the compiler's
  // automatic @types/* acquisition so unrelated ambient declarations
  // never enter the parsed entity set.
  types: [],
};

/**
 * Detects and interprets tsconfig.json or jsconfig.json when present.
 * A missing or malformed configuration falls back to permissive
 * defaults with a diagnostic rather than aborting the run.
 */
export function resolveConfiguration(rootPath: string): ResolvedConfiguration {
  const tsConfigPath = join(rootPath, "tsconfig.json");
  const jsConfigPath = join(rootPath, "jsconfig.json");

  const configPath = existsSync(tsConfigPath)
    ? tsConfigPath
    : existsSync(jsConfigPath)
      ? jsConfigPath
      : undefined;

  if (!configPath) {
    return {
      compilerOptions: DEFAULT_COMPILER_OPTIONS,
      fileNames: [],
      diagnostics: [],
    };
  }

  const configRelativePath = toProjectRelativePath(rootPath, configPath);
  const readResult = ts.readConfigFile(configPath, ts.sys.readFile);

  if (readResult.error) {
    return {
      compilerOptions: DEFAULT_COMPILER_OPTIONS,
      fileNames: [],
      diagnostics: [
        {
          code: "tsconfig-read-error",
          severity: "warning",
          message: ts.flattenDiagnosticMessageText(readResult.error.messageText, "\n"),
          filePath: configRelativePath,
          recoverable: true,
        },
      ],
    };
  }

  const parsed = ts.parseJsonConfigFileContent(readResult.config, ts.sys, rootPath);

  const diagnostics: Diagnostic[] = parsed.errors.map((error) => ({
    code: "tsconfig-parse-error",
    severity: "warning",
    message: ts.flattenDiagnosticMessageText(error.messageText, "\n"),
    filePath: configRelativePath,
    recoverable: true,
  }));

  const options = parsed.options;
  const signal: TypeScriptConfigSignal = {
    configPath: configRelativePath,
    allowJs: options.allowJs ?? true,
    checkJs: options.checkJs ?? false,
    jsx: options.jsx !== undefined ? ts.JsxEmit[options.jsx] : undefined,
    module: options.module !== undefined ? ts.ModuleKind[options.module] : undefined,
    moduleResolution:
      options.moduleResolution !== undefined
        ? ts.ModuleResolutionKind[options.moduleResolution]
        : undefined,
    target: options.target !== undefined ? ts.ScriptTarget[options.target] : undefined,
    sourceMap: Boolean(options.sourceMap),
    paths: options.paths as Record<string, string[]> | undefined,
    baseUrl: options.baseUrl,
    projectReferences: (parsed.projectReferences ?? []).map((ref) =>
      toProjectRelativePath(rootPath, ref.path),
    ),
    include: Array.isArray(readResult.config?.include) ? readResult.config.include : undefined,
    exclude: Array.isArray(readResult.config?.exclude) ? readResult.config.exclude : undefined,
  };

  return {
    signal,
    compilerOptions: {
      ...DEFAULT_COMPILER_OPTIONS,
      ...options,
    },
    fileNames: parsed.fileNames,
    diagnostics,
  };
}
