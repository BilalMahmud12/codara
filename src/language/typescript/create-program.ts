import ts from "typescript";

/**
 * Isolates ts.Program construction so callers never need to touch
 * the TypeScript Compiler API directly.
 */
export function createProgram(
  rootFileNames: string[],
  compilerOptions: ts.CompilerOptions,
): ts.Program {
  return ts.createProgram({ rootNames: rootFileNames, options: compilerOptions });
}
