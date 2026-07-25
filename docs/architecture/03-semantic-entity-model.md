# Semantic Entity Model

> **Status:** Implemented in Phase 1. This document describes the actual public DTOs in
> `src/model/entity.ts` and the extraction logic in `src/language/typescript/extract-entities.ts`.
> It is a companion to, and stays consistent with, [docs/semantic-model.md](../semantic-model.md).

## What qualifies as a semantic entity

A semantic entity is a meaningful, individually addressable structural unit recovered from a
source file: a module, a class, a function, a variable that holds one, an import or export
declaration. "Meaningful" is doing real work in that sentence — Phase 1 deliberately does not turn
every syntax node into an entity. A local variable assigned a plain value inside a function body is
not an entity (see [Current exclusions](#current-exclusions-by-design)); a class declared at the
top of a file is.

## Entity kinds supported in Phase 1

```ts
export type SemanticEntityKind =
  | "module"
  | "class"
  | "interface"
  | "typeAlias"
  | "enum"
  | "constructor"
  | "method"
  | "getter"
  | "setter"
  | "functionDeclaration"
  | "arrowFunction"
  | "functionExpression"
  | "objectMethod"
  | "variable"
  | "importDeclaration"
  | "exportDeclaration";
```

This is a closed, fixed set for Phase 1 — it is not extensible at runtime, and no other kind
appears in Phase 1 output. `docs/semantic-model.md` lists the same set; if the two ever diverge,
the source (`src/model/entity.ts`) is authoritative.

Kind and role are intentionally kept separate. `kind` describes the language-level shape of a
declaration; a future _role_ (e.g. tagging a `method` as an `http-endpoint`) would describe a
framework-level meaning layered on top, without replacing `kind`. Phase 1 defines the `roles: []`
field on every entity but never populates it — this is a seam for framework-aware enrichment in a
later phase, not a Phase 1 capability.

## The public shape

```ts
export interface SemanticEntity {
  id: string;
  projectId: string;
  fileId: string;
  kind: SemanticEntityKind;
  name?: string;
  qualifiedName?: string;
  parentId?: string;
  location: SourceLocation;
  flags: EntityFlags;
  roles: SemanticRole[]; // always [] in Phase 1
  confidence: number; // always 1 for Phase 1 entities
  evidenceIds: string[];
}

export interface SourceLocation {
  filePath: string; // project-relative, POSIX-style
  start: SourcePosition; // 1-based line/column
  end: SourcePosition;
}

export interface EntityFlags {
  exported: boolean;
  async: boolean;
  static: boolean;
  abstract: boolean;
  readonly: boolean;
  generator: boolean;
  visibility?: "public" | "private" | "protected"; // only set for class members
}
```

## Source locations

`location.filePath` is always the entity's own file's project-relative path — never an absolute
filesystem path (this is enforced by construction: the extractor is only ever given the file's
already-normalized `relativePath`, never the absolute path the compiler internally uses to load the
file). `start`/`end` are 1-based line and column, taken directly from the TypeScript AST node's
span via `sourceFile.getLineAndCharacterOfPosition(...)`, with no adjustment beyond the 0-based →
1-based conversion.

## Parent/containment

Every non-module entity has a `parentId` pointing at its structural parent: a class method's parent
is its class; a class's or top-level function's parent is its module; a nested arrow/function
expression's parent is the `variable` entity that holds it. A module entity has no `parentId`. This
same parent/child relationship is _also_ emitted as an explicit `contains` relationship (see
[04-relationship-model.md](04-relationship-model.md)) — `parentId` is the convenient flat form,
`contains` is the graph-edge form; they always agree.

## Deterministic ids

Entity ids follow one fixed, transparent scheme:

```text
<project-relative file path>::<kind>:<discriminator>::<kind>:<discriminator>...
```

- A **module** entity's id is just its file's project-relative path, with no `::` chain.
- A **named, function-like** entity (`constructor`, `method`, `getter`, `setter`,
  `functionDeclaration`, `arrowFunction`, `functionExpression` when named) uses
  `name(paramName:paramType,...)` as its discriminator — the parameter list disambiguates
  overloads and same-named methods across sibling classes.
- An **anonymous** function-like entity (an unnamed arrow function or function expression) has no
  stable name, so its discriminator is its 1-based source position: `@line:column`.
- Every other kind (`class`, `interface`, `typeAlias`, `enum`, `variable`, `objectMethod`) uses its
  declared name as the discriminator.

Example, straight from the spec and matched exactly by the implementation:

```text
src/wallet/wallet.service.ts::class:WalletService::method:debit(amount:number,walletId:string)
```

Identity generation is isolated behind three plain functions in `src/identity/entity-id.ts`
(`createProjectId`, `createFileId`, `createEntityId`) with no compiler-specific inputs, so a future
identity scheme — content fingerprints, git-aware rename tracking — can replace the discriminator
logic without any call site changing.

## Flags

`exported`, `async`, `static`, `abstract`, `readonly`, and `generator` are derived directly from
TypeScript AST modifiers (`ExportKeyword`, `AsyncKeyword`, `StaticKeyword`, `AbstractKeyword`,
`ReadonlyKeyword`, and the presence of an `asteriskToken` on a function-like node) — plus one
additional signal: `exported` is also `true` when an entity's name appears in a same-file
`export { name }` list, even without an `export` modifier directly on the declaration.
`visibility` is only ever set for class members (`method`, `constructor`, `getter`, `setter`);
it defaults to `"public"` unless a `private`/`protected` modifier is present, and is `undefined` on
every other entity kind.

## Why compiler-specific objects never cross the public boundary

`ts.Node`, `ts.Symbol`, `ts.Type`, `ts.SourceFile`, and `ts.Program` are all internal to
`src/language/typescript/*`. The moment `extractEntitiesForFile` builds a `SemanticEntity`, every
field on it is already a plain string, number, boolean, or nested plain object — there is no
lazily-evaluated reference back into the compiler's object graph. This is enforced structurally,
not by a runtime check: `src/model/*` (the public DTO layer) never imports `typescript`, and
neither does `src/index.ts` or `src/cli/*`. A consumer of `CodaraAnalysisResult` can `JSON.stringify`
it, persist it, or send it to another process with no special handling.

This matters for two reasons: it keeps the result fully serializable (a hard requirement — see
[08-public-api.md](08-public-api.md)), and it keeps memory bounded — the compiler's `Program` and
every `SourceFile` it parsed can be released once extraction for that file is done; nothing in the
returned model keeps them alive.

## Current exclusions (by design)

- **Local variables inside function/method bodies are not entities.** Only module-scope
  (top-level) `const`/`let`/`var` statements produce a `variable` entity. A `const wallet = ...`
  inside a method body is not modeled — Phase 1 is a structural inventory, not a local
  data-flow or variable tracker. Nested function and class _declarations_ inside a body are still
  surfaced, with correct containment, because they are themselves structural units, not data.
- **A function-valued variable produces two entities, not one.** `const x = () => {}` (or a
  function expression) creates a `variable` entity named `x` and a nested
  `arrowFunction`/`functionExpression` entity whose `parentId` is that variable — mirroring the
  source, where a binding holds a function value.
- **Object-literal methods are captured "where practical," not exhaustively.** Phase 1 recognizes
  `MethodDeclaration` properties and property assignments whose value is a function/arrow
  expression, wherever an object literal appears during the walk — not only when the object
  literal is the direct initializer of a top-level variable.
- **No type-level resolution.** Parameter "types" used in discriminators and evidence are the
  parameter's syntactic type annotation text (or the literal string `"any"` if absent) — never a
  type resolved through the checker. `confidence` on every Phase 1 entity is `1` because entities
  come directly from syntax, not from a heuristic that could be wrong.

## Future extension principles

If a later phase adds new entity kinds (e.g. a `namespace` kind, or property/field entities), the
existing scheme is designed to absorb them without breaking:

- New kinds extend the `SemanticEntityKind` union; existing kinds and their id format do not
  change.
- `roles` remains the seam for framework-specific meaning — a role should never require inventing a
  new `kind` for something that is structurally the same shape (e.g. "this method is an HTTP
  handler" is a role on a `method`, not a new entity kind).
- Any new per-kind data should be optional and additive to `SemanticEntity`, never a breaking
  change to existing fields, per the schema-versioning rule in
  [08-public-api.md](08-public-api.md#schema-versioning).

---

Previous: [02 — Project Discovery](02-project-discovery.md) · Next: [04 — Relationship Model](04-relationship-model.md)
