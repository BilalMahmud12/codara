import ts from "typescript";
import type { SemanticEntityKind } from "../../model/entity.js";

/**
 * Maps a narrow set of TypeScript syntax kinds to Phase 1 entity kinds.
 * Node classification here is intentionally shallow: it distinguishes
 * declaration shape, not resolved type information.
 */
export function mapDeclarationKind(node: ts.Node): SemanticEntityKind | undefined {
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "typeAlias";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isGetAccessorDeclaration(node)) return "getter";
  if (ts.isSetAccessorDeclaration(node)) return "setter";
  if (ts.isMethodDeclaration(node)) return "method";
  if (ts.isFunctionDeclaration(node)) return "functionDeclaration";
  if (ts.isArrowFunction(node)) return "arrowFunction";
  if (ts.isFunctionExpression(node)) return "functionExpression";
  if (ts.isMethodSignature(node)) return "method";
  return undefined;
}

export function isTopLevelVariableStatement(node: ts.Node): node is ts.VariableStatement {
  return ts.isVariableStatement(node);
}
