import ts from "typescript";
import type { EntityFlags, SemanticEntity, SourceLocation } from "../../model/entity.js";
import type { SemanticEvidence } from "../../model/evidence.js";
import type { SemanticRelationship } from "../../model/relationship.js";
import type { Diagnostic } from "../../model/diagnostic.js";
import {
  createEntityId,
  positionDiscriminator,
  type EntityIdSegment,
} from "../../identity/entity-id.js";
import { mapDeclarationKind } from "./syntax-kind-mapping.js";

export interface ImportRecord {
  entityId: string;
  specifier: string;
  isTypeOnly: boolean;
  location: SourceLocation;
}

export type ExportRecord =
  | {
      kind: "local";
      entityId: string;
      exportedName: string;
      location: SourceLocation;
    }
  | {
      kind: "reExport";
      entityId: string;
      specifier: string;
      exportedName?: string;
      location: SourceLocation;
    }
  | {
      kind: "defaultExport";
      entityId: string;
      location: SourceLocation;
    };

export interface ExtractFileResult {
  entities: SemanticEntity[];
  evidence: SemanticEvidence[];
  relationships: SemanticRelationship[];
  diagnostics: Diagnostic[];
  importRecords: ImportRecord[];
  exportRecords: ExportRecord[];
}

interface WalkContext {
  sourceFile: ts.SourceFile;
  relativePath: string;
  projectId: string;
  fileId: string;
  entities: SemanticEntity[];
  evidence: SemanticEvidence[];
  relationships: SemanticRelationship[];
  importRecords: ImportRecord[];
  exportRecords: ExportRecord[];
}

export function extractEntitiesForFile(
  sourceFile: ts.SourceFile,
  relativePath: string,
  projectId: string,
  fileId: string,
): ExtractFileResult {
  const context: WalkContext = {
    sourceFile,
    relativePath,
    projectId,
    fileId,
    entities: [],
    evidence: [],
    relationships: [],
    importRecords: [],
    exportRecords: [],
  };

  const moduleId = relativePath;
  const moduleLocation = nodeLocation(context, sourceFile);
  context.entities.push({
    id: moduleId,
    projectId,
    fileId,
    kind: "module",
    name: relativePath,
    qualifiedName: relativePath,
    location: moduleLocation,
    flags: emptyFlags(),
    roles: [],
    confidence: 1,
    evidenceIds: [addDeclarationEvidence(context, moduleId, "module", moduleLocation)],
  });

  const exportedLocalNames = new Set<string>();
  sourceFile.forEachChild((node) => {
    collectTopLevelExportNames(node, exportedLocalNames);
  });

  sourceFile.forEachChild((node) => {
    walkNode(context, node, moduleId, [], exportedLocalNames, true);
  });

  return {
    entities: context.entities,
    evidence: context.evidence,
    relationships: context.relationships,
    diagnostics: [],
    importRecords: context.importRecords,
    exportRecords: context.exportRecords,
  };
}

function walkNode(
  context: WalkContext,
  node: ts.Node,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
  exportedLocalNames: Set<string>,
  atStatementLevel = false,
): void {
  if (ts.isImportDeclaration(node)) {
    handleImportDeclaration(context, node, parentId, ancestorSegments);
    return;
  }

  if (ts.isExportDeclaration(node)) {
    handleExportDeclaration(context, node, parentId, ancestorSegments);
    return;
  }

  if (ts.isExportAssignment(node)) {
    handleExportAssignment(context, node, parentId, ancestorSegments);
    return;
  }

  if (ts.isVariableStatement(node) && atStatementLevel) {
    handleVariableStatement(context, node, parentId, ancestorSegments, exportedLocalNames);
    return;
  }

  const kind = mapDeclarationKind(node);
  if (kind) {
    const entity = declareEntity(
      context,
      node,
      kind,
      parentId,
      ancestorSegments,
      exportedLocalNames,
    );
    const nextSegments = [...ancestorSegments, entity.segment];

    if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      for (const member of node.members) {
        walkNode(context, member, entity.entity.id, nextSegments, exportedLocalNames);
      }
    } else if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      if (node.body) {
        walkBodyForNestedDeclarations(
          context,
          node.body,
          entity.entity.id,
          nextSegments,
          exportedLocalNames,
        );
      }
    }
    return;
  }

  if (ts.isObjectLiteralExpression(node)) {
    handleObjectLiteral(context, node, parentId, ancestorSegments);
    return;
  }

  node.forEachChild((child) => {
    walkNode(context, child, parentId, ancestorSegments, exportedLocalNames);
  });
}

/**
 * Walks a function/method body looking only for nested declarations we
 * still want to surface (classes, functions, named object literals with
 * methods). Ordinary statements are not otherwise modeled in Phase 1.
 */
/**
 * Deliberately does not treat nested statements as statement-level:
 * Phase 1's "top-level variable" entity applies to module scope only,
 * not every local binding inside a function body. Nested function and
 * class declarations are still surfaced via the generic fallback walk.
 */
function walkBodyForNestedDeclarations(
  context: WalkContext,
  node: ts.Node,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
  exportedLocalNames: Set<string>,
): void {
  node.forEachChild((child) => {
    walkNode(context, child, parentId, ancestorSegments, exportedLocalNames, false);
  });
}

function declareEntity(
  context: WalkContext,
  node: ts.Node,
  kind: SemanticEntity["kind"],
  parentId: string,
  ancestorSegments: EntityIdSegment[],
  exportedLocalNames: Set<string>,
): { entity: SemanticEntity; segment: EntityIdSegment } {
  const name = getDeclarationName(node);
  const discriminator = buildDiscriminator(context.sourceFile, node, kind, name);
  const segment: EntityIdSegment = { kind, discriminator };
  const id = createEntityId(context.relativePath, [...ancestorSegments, segment]);
  const location = nodeLocation(context, node);
  const flags = buildFlags(node, name, exportedLocalNames);
  const qualifiedName = [...ancestorSegments.map((segmentPart) => segmentPart.discriminator), name]
    .filter((part): part is string => Boolean(part))
    .join(".");

  const entity: SemanticEntity = {
    id,
    projectId: context.projectId,
    fileId: context.fileId,
    kind,
    name,
    qualifiedName: qualifiedName.length > 0 ? qualifiedName : undefined,
    parentId,
    location,
    flags,
    roles: [],
    confidence: 1,
    evidenceIds: [addDeclarationEvidence(context, id, kind, location)],
  };

  context.entities.push(entity);
  context.relationships.push(containsRelationship(context, parentId, id, location));

  return { entity, segment };
}

function handleVariableStatement(
  context: WalkContext,
  node: ts.VariableStatement,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
  exportedLocalNames: Set<string>,
): void {
  const exported = hasModifier(node, ts.SyntaxKind.ExportKeyword);

  for (const declaration of node.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) {
      continue;
    }
    const name = declaration.name.text;
    const segment: EntityIdSegment = { kind: "variable", discriminator: name };
    const id = createEntityId(context.relativePath, [...ancestorSegments, segment]);
    const location = nodeLocation(context, declaration);
    const flags: EntityFlags = {
      exported: exported || exportedLocalNames.has(name),
      async: false,
      static: false,
      abstract: false,
      readonly: hasModifier(node, ts.SyntaxKind.ConstKeyword) || isConstDeclaration(node),
      generator: false,
    };

    const entity: SemanticEntity = {
      id,
      projectId: context.projectId,
      fileId: context.fileId,
      kind: "variable",
      name,
      qualifiedName: name,
      parentId,
      location,
      flags,
      roles: [],
      confidence: 1,
      evidenceIds: [addDeclarationEvidence(context, id, "variable", location)],
    };
    context.entities.push(entity);
    context.relationships.push(containsRelationship(context, parentId, id, location));

    const initializer = declaration.initializer;
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      const nextSegments = [...ancestorSegments, segment];
      walkNode(context, initializer, id, nextSegments, exportedLocalNames);
    } else if (initializer && ts.isObjectLiteralExpression(initializer)) {
      handleObjectLiteral(context, initializer, id, [...ancestorSegments, segment]);
    }
  }
}

function handleObjectLiteral(
  context: WalkContext,
  node: ts.ObjectLiteralExpression,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
): void {
  for (const property of node.properties) {
    if (ts.isMethodDeclaration(property) && property.name && ts.isIdentifier(property.name)) {
      declareObjectMethod(context, property, property.name.text, parentId, ancestorSegments);
    } else if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      (ts.isArrowFunction(property.initializer) || ts.isFunctionExpression(property.initializer))
    ) {
      declareObjectMethod(
        context,
        property.initializer,
        property.name.text,
        parentId,
        ancestorSegments,
      );
    }
  }
}

function declareObjectMethod(
  context: WalkContext,
  node: ts.FunctionLikeDeclaration,
  name: string,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
): void {
  const discriminator = `${name}${buildSignatureSuffix(context.sourceFile, node)}`;
  const segment: EntityIdSegment = { kind: "objectMethod", discriminator };
  const id = createEntityId(context.relativePath, [...ancestorSegments, segment]);
  const location = nodeLocation(context, node);

  const entity: SemanticEntity = {
    id,
    projectId: context.projectId,
    fileId: context.fileId,
    kind: "objectMethod",
    name,
    qualifiedName: name,
    parentId,
    location,
    flags: {
      exported: false,
      async: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
      static: false,
      abstract: false,
      readonly: false,
      generator: Boolean(node.asteriskToken),
    },
    roles: [],
    confidence: 1,
    evidenceIds: [addDeclarationEvidence(context, id, "objectMethod", location)],
  };
  context.entities.push(entity);
  context.relationships.push(containsRelationship(context, parentId, id, location));
}

function handleImportDeclaration(
  context: WalkContext,
  node: ts.ImportDeclaration,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
): void {
  if (!ts.isStringLiteral(node.moduleSpecifier)) {
    return;
  }
  const specifier = node.moduleSpecifier.text;
  const segment: EntityIdSegment = { kind: "importDeclaration", discriminator: specifier };
  const id = createEntityId(context.relativePath, [...ancestorSegments, segment]);
  const location = nodeLocation(context, node);
  const isTypeOnly = Boolean(node.importClause?.isTypeOnly);

  context.entities.push({
    id,
    projectId: context.projectId,
    fileId: context.fileId,
    kind: "importDeclaration",
    name: specifier,
    qualifiedName: specifier,
    parentId,
    location,
    flags: { ...emptyFlags() },
    roles: [],
    confidence: 1,
    evidenceIds: [addDeclarationEvidence(context, id, "importDeclaration", location)],
  });
  context.relationships.push(containsRelationship(context, parentId, id, location));
  context.importRecords.push({ entityId: id, specifier, isTypeOnly, location });
}

function handleExportDeclaration(
  context: WalkContext,
  node: ts.ExportDeclaration,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
): void {
  const specifier =
    node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
      ? node.moduleSpecifier.text
      : undefined;
  const label =
    specifier ??
    (node.exportClause && ts.isNamedExports(node.exportClause)
      ? node.exportClause.elements.map((element) => element.name.text).join(",")
      : "*");
  const segment: EntityIdSegment = { kind: "exportDeclaration", discriminator: label };
  const id = createEntityId(context.relativePath, [...ancestorSegments, segment]);
  const location = nodeLocation(context, node);

  context.entities.push({
    id,
    projectId: context.projectId,
    fileId: context.fileId,
    kind: "exportDeclaration",
    name: label,
    qualifiedName: label,
    parentId,
    location,
    flags: { ...emptyFlags() },
    roles: [],
    confidence: 1,
    evidenceIds: [addDeclarationEvidence(context, id, "exportDeclaration", location)],
  });
  context.relationships.push(containsRelationship(context, parentId, id, location));

  if (specifier) {
    if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        context.exportRecords.push({
          kind: "reExport",
          entityId: id,
          specifier,
          exportedName: element.name.text,
          location,
        });
      }
    } else {
      context.exportRecords.push({ kind: "reExport", entityId: id, specifier, location });
    }
  } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const element of node.exportClause.elements) {
      const localName = element.propertyName?.text ?? element.name.text;
      context.exportRecords.push({
        kind: "local",
        entityId: id,
        exportedName: localName,
        location,
      });
    }
  }
}

function handleExportAssignment(
  context: WalkContext,
  node: ts.ExportAssignment,
  parentId: string,
  ancestorSegments: EntityIdSegment[],
): void {
  if (node.isExportEquals) {
    return;
  }
  const segment: EntityIdSegment = { kind: "exportDeclaration", discriminator: "default" };
  const id = createEntityId(context.relativePath, [...ancestorSegments, segment]);
  const location = nodeLocation(context, node);

  context.entities.push({
    id,
    projectId: context.projectId,
    fileId: context.fileId,
    kind: "exportDeclaration",
    name: "default",
    qualifiedName: "default",
    parentId,
    location,
    flags: { ...emptyFlags() },
    roles: [],
    confidence: 1,
    evidenceIds: [addDeclarationEvidence(context, id, "exportDeclaration", location)],
  });
  context.relationships.push(containsRelationship(context, parentId, id, location));
  context.exportRecords.push({ kind: "defaultExport", entityId: id, location });
}

function collectTopLevelExportNames(node: ts.Node, names: Set<string>): void {
  if (
    ts.isExportDeclaration(node) &&
    !node.moduleSpecifier &&
    node.exportClause &&
    ts.isNamedExports(node.exportClause)
  ) {
    for (const element of node.exportClause.elements) {
      names.add(element.propertyName?.text ?? element.name.text);
    }
  }
}

function buildFlags(
  node: ts.Node,
  name: string | undefined,
  exportedLocalNames: Set<string>,
): EntityFlags {
  const isDefaultExport = hasModifier(node, ts.SyntaxKind.DefaultKeyword);
  const exported =
    hasModifier(node, ts.SyntaxKind.ExportKeyword) ||
    isDefaultExport ||
    (name !== undefined && exportedLocalNames.has(name));

  const isFunctionLike =
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node);

  const generator =
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isFunctionExpression(node)) &&
    Boolean(node.asteriskToken);

  return {
    exported,
    async: isFunctionLike && hasModifier(node, ts.SyntaxKind.AsyncKeyword),
    static: hasModifier(node, ts.SyntaxKind.StaticKeyword),
    abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
    readonly: hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
    generator,
    visibility: resolveVisibility(node),
  };
}

function resolveVisibility(node: ts.Node): EntityFlags["visibility"] {
  const isMember =
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node);
  if (!isMember) {
    return undefined;
  }
  if (hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return "private";
  if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword)) return "protected";
  return "public";
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) {
    return false;
  }
  const modifiers = ts.getModifiers(node as ts.HasModifiers);
  return modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function isConstDeclaration(node: ts.VariableStatement): boolean {
  return (node.declarationList.flags & ts.NodeFlags.Const) !== 0;
}

function getDeclarationName(node: ts.Node): string | undefined {
  if (
    (ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isFunctionDeclaration(node)) &&
    node.name
  ) {
    return node.name.text;
  }
  if (
    (ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isMethodSignature(node)) &&
    ts.isIdentifier(node.name)
  ) {
    return node.name.text;
  }
  if (ts.isConstructorDeclaration(node)) {
    return "constructor";
  }
  if (ts.isFunctionExpression(node) && node.name) {
    return node.name.text;
  }
  return undefined;
}

function buildDiscriminator(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: SemanticEntity["kind"],
  name: string | undefined,
): string {
  const isFunctionLike =
    kind === "constructor" ||
    kind === "method" ||
    kind === "getter" ||
    kind === "setter" ||
    kind === "functionDeclaration" ||
    kind === "arrowFunction" ||
    kind === "functionExpression";

  if (name && isFunctionLike) {
    return `${name}${buildSignatureSuffix(sourceFile, node as ts.FunctionLikeDeclaration)}`;
  }
  if (name) {
    return name;
  }
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return positionDiscriminator(start.line + 1, start.character + 1);
}

function buildSignatureSuffix(sourceFile: ts.SourceFile, node: ts.FunctionLikeDeclaration): string {
  const params = node.parameters
    .map((parameter) => {
      const paramName = ts.isIdentifier(parameter.name)
        ? parameter.name.text
        : parameter.name.getText(sourceFile);
      const typeText = parameter.type ? parameter.type.getText(sourceFile) : "any";
      return `${paramName}:${typeText}`;
    })
    .join(",");
  return `(${params})`;
}

function nodeLocation(context: WalkContext, node: ts.Node): SourceLocation {
  const sourceFile = context.sourceFile;
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    filePath: context.relativePath,
    start: { line: start.line + 1, column: start.character + 1 },
    end: { line: end.line + 1, column: end.character + 1 },
  };
}

function emptyFlags(): EntityFlags {
  return {
    exported: false,
    async: false,
    static: false,
    abstract: false,
    readonly: false,
    generator: false,
  };
}

function addDeclarationEvidence(
  context: WalkContext,
  subjectId: string,
  kind: string,
  location: SourceLocation,
): string {
  const id = `evidence:${subjectId}::declaration`;
  context.evidence.push({
    id,
    type: "syntaxDeclaration",
    subjectId,
    location,
    confidence: 1,
    details: { kind },
    explanation: `Declared as ${kind} in source.`,
  });
  return id;
}

function containsRelationship(
  context: WalkContext,
  parentId: string,
  childId: string,
  location: SourceLocation,
): SemanticRelationship {
  const id = `relationship:contains:${parentId}=>${childId}`;
  const evidenceId = `evidence:${id}`;
  context.evidence.push({
    id: evidenceId,
    type: "sourceRange",
    subjectId: id,
    location,
    confidence: 1,
    details: {},
    explanation: "Derived from AST containment.",
  });
  return {
    id,
    sourceId: parentId,
    targetId: childId,
    kind: "contains",
    location,
    confidence: 1,
    evidenceIds: [evidenceId],
  };
}
