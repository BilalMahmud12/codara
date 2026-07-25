import type { CodaraAnalysisResult } from "../model/analysis-result.js";

export function renderSummary(
  result: CodaraAnalysisResult,
  displayRootPath: string,
  outputPath: string | undefined,
): string {
  const kindCounts = result.metrics.entityCountsByKind;
  const classes = kindCounts.class ?? 0;
  const interfaces = kindCounts.interface ?? 0;
  const functions =
    (kindCounts.functionDeclaration ?? 0) +
    (kindCounts.arrowFunction ?? 0) +
    (kindCounts.functionExpression ?? 0);
  const methods =
    (kindCounts.method ?? 0) +
    (kindCounts["constructor"] ?? 0) +
    (kindCounts.getter ?? 0) +
    (kindCounts.setter ?? 0);
  const totalEntities = Object.values(kindCounts).reduce((sum, count) => sum + count, 0);
  const other = totalEntities - classes - interfaces - functions - methods;

  const moduleSystemLabel =
    result.project.moduleSystem === "esm"
      ? "ESM"
      : result.project.moduleSystem === "commonjs"
        ? "CommonJS"
        : "Unknown";

  const lines = [
    "Codara Phase 1",
    "",
    `Project: ${result.project.name ?? "(unnamed)"}`,
    `Root: ${displayRootPath}`,
    `Module system: ${moduleSystemLabel}`,
    "",
    `Files discovered: ${result.metrics.filesDiscovered}`,
    `Files analyzed: ${result.metrics.filesAnalyzed}`,
    `Production files: ${result.metrics.productionFiles}`,
    `Probable test files: ${result.metrics.probableTestFiles}`,
    "",
    "Entities:",
    `  Classes: ${classes}`,
    `  Interfaces: ${interfaces}`,
    `  Functions: ${functions}`,
    `  Methods: ${methods}`,
    `  Other: ${other}`,
    "",
    `Diagnostics: ${result.metrics.diagnosticCounts.warning} warnings, ${result.metrics.diagnosticCounts.error} errors`,
    `Output: ${outputPath ?? "not written (--no-write)"}`,
  ];

  return lines.join("\n");
}
