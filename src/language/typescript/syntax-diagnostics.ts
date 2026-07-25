import ts from "typescript";
import type { Diagnostic } from "../../model/diagnostic.js";

export function toSyntaxDiagnostics(
  sourceFile: ts.SourceFile,
  diagnostics: readonly ts.Diagnostic[],
  relativePath: string,
): Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    const position =
      diagnostic.start !== undefined
        ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start)
        : undefined;
    return {
      code: `TS${diagnostic.code}`,
      severity: "error",
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      filePath: relativePath,
      location: position
        ? {
            filePath: relativePath,
            start: { line: position.line + 1, column: position.character + 1 },
            end: { line: position.line + 1, column: position.character + 1 },
          }
        : undefined,
      recoverable: true,
    };
  });
}
