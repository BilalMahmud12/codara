# Codara Semantic Model — Phase 1

This document explains the public model Codara Phase 1 emits, how identity and evidence work, and
which parts of the full six-model design are implemented now versus reserved as seams for later
phases. It complements [CODARA_ENGINE_CONCEPT_AND_PHASE1.md](../CODARA_ENGINE_CONCEPT_AND_PHASE1.md),
which is the authoritative product/scope specification.

## The six conceptual models

Codara's long-term design has six connected models. Phase 1 implements the first three fully, the
fourth partially, and leaves the last two as documented seams.

| Model                   | Phase 1 status                                                          |
| ----------------------- | ----------------------------------------------------------------------- |
| Project Model           | Implemented (single-package scope; workspace signals only)              |
| Semantic Entity Model   | Implemented (a fixed, compact set of entity kinds)                      |
| Relationship Model      | Implemented (`contains`, `imports`, `exports`, `reExports` only)        |
| Semantic Evidence Model | Implemented (evidence for every declaration and relationship)           |
| Behavioral Model        | Seam only — types exist (`src/model/behavior.ts`), nothing is extracted |
| Query/Context Model     | Seam only — types exist (`src/model/query.ts`), nothing is implemented  |

Seam types are not re-exported anywhere internal logic depends on them; they exist purely so a
future phase can implement behavior extraction or query/context compilation without a breaking
change to `CodaraAnalysisResult`.

## Project Model

`ProjectSummary` (embedded in `CodaraAnalysisResult.project`) describes the analysis boundary:

- `identity` — name, version, package manager, module system, all derived from `package.json` and
  lockfile presence.
- `capabilities` — what Phase 1 was actually able to do for this project (`syntaxAnalysis` is
  always true; `typeAnalysis` reflects whether a `tsconfig.json`/`jsconfig.json` was found;
  `symbolResolution` is always `false` in Phase 1 — no checker-based symbol resolution is
  performed; `sourceMaps` reflects the `sourceMap` compiler option; `workspaceDetected` reflects
  workspace signal detection).
- `workspaceMemberCandidates` — directories matching workspace glob patterns, reported as a signal.
  Phase 1 does not analyze these as separate packages.

Phase 1 supports a single-package root robustly. Workspace detection is a signal, not a promise of
full multi-package resolution — a later phase would walk into each member and produce a project
graph per package.

## Semantic Entity Model

Every entity (`SemanticEntity`) has:

- `id` — deterministic, see [Identity](#identity-and-determinism).
- `kind` — one of `module`, `class`, `interface`, `typeAlias`, `enum`, `constructor`, `method`,
  `getter`, `setter`, `functionDeclaration`, `arrowFunction`, `functionExpression`,
  `objectMethod`, `variable`, `importDeclaration`, `exportDeclaration`.
- `name` / `qualifiedName` — best-effort declared name; anonymous function-likes have no `name`
  and are disambiguated by source position instead.
- `parentId` — containment parent (a class for its methods, a module for its top-level entities,
  a variable for a nested arrow/function-expression initializer).
- `location` — a project-relative `filePath` plus 1-based `start`/`end` line/column.
- `flags` — `exported`, `async`, `static`, `abstract`, `readonly`, `generator`, and an optional
  `visibility` (`public`/`private`/`protected`), populated only for class members.
- `roles` — always empty in Phase 1. Reserved for future framework-aware enrichment (e.g. tagging
  a method with an `http-endpoint` role) that layers on top of, rather than replaces, `kind`.
- `confidence` — always `1` for Phase 1 entities; they come directly from syntax, not heuristics.
- `evidenceIds` — at least one `syntaxDeclaration` evidence record.

**Scope notes:**

- "Top-level variable" means module-scope `const`/`let`/`var` statements. Local variables declared
  inside a function or method body are not modeled as entities — Phase 1 is a structural
  inventory, not a data-flow or local-variable tracker. Nested function/class declarations inside a
  body are still surfaced, with correct containment, because they are themselves structural units.
- Object-literal methods (`{ get() {}, other: () => {} }`) are captured as `objectMethod` "where
  practical" per the spec: Phase 1 recognizes `MethodDeclaration` properties and
  property-assignments whose value is a function/arrow expression, wherever an object literal
  appears in the walk (not only when assigned to a top-level variable).
- A `const x = () => {}` (or function expression) produces **two** entities: a `variable` entity
  named `x`, and a nested `arrowFunction`/`functionExpression` entity whose parent is that
  variable. This mirrors the source: a binding that holds a function value.

## Relationship Model

Phase 1 implements exactly four relationship kinds — `contains`, `imports`, `exports`,
`reExports` — deliberately narrower than the full long-term kind list (`calls`, `constructs`,
`extends`, `implements`, `reads`, `writes`, `returns`, `throws`, `dependsOn`, `exposes`), which
require symbol resolution or control-flow analysis Phase 1 does not perform.

- `contains` — structural containment (file→entity, class→member, variable→nested function). Not
  usually interesting to consumers directly, but read from `entity.parentId` if a flat form is more
  convenient.
- `imports` — module→module, derived from `import ... from "specifier"`. When the specifier is
  relative, Codara resolves it against the file inventory (including TS-style `./foo.js` specifiers
  that actually resolve to a sibling `.ts`/`.tsx` file). When it can't be resolved cheaply (bare
  package name, `tsconfig` path alias, non-existent target), `targetId` is left `undefined` and the
  relationship's `confidence` drops below `1` — Codara never fabricates a guessed target.
- `exports` — module→entity, derived from an `export` modifier on a declaration, a named
  `export { x }` list, or `export default`. If the exported name can't be matched to a local entity
  (e.g. `export default someExpression`), `targetId` is left `undefined`.
- `reExports` — module→module, derived from `export { x } from "specifier"` / `export * from
"specifier"`, resolved the same way as `imports`.

Every relationship carries an `evidenceIds` reference explaining how it was derived and a
`confidence` reflecting whether the target was actually resolved.

## Semantic Evidence Model

Every entity and every relationship has at least one `SemanticEvidence` record. Phase 1 uses three
evidence types:

- `syntaxDeclaration` — "this entity exists because the AST contains this declaration."
- `sourceRange` — backs `contains` relationships, referencing the containing/contained source
  range.
- `importBinding` — backs `imports`/`exports`/`reExports`, recording the specifier or exported name
  and whether resolution succeeded.

`manifestSignal`, `configurationSignal`, and `namingHeuristic` are defined in the evidence type
union for future discovery-stage evidence (e.g. "detected React because it's a dependency") but are
not yet emitted by Phase 1's own diagnostics-producing stages, which currently report findings as
`Diagnostic`s instead.

## Identity and determinism

Entity IDs follow the scheme described in the spec:

```text
project-relative path :: kind:discriminator :: kind:discriminator ...
```

For example:

```text
src/wallet/wallet.service.ts::class:WalletService::method:debit(amount:number,walletId:string)
```

- The discriminator for a named function-like entity is `name(param:type,...)` — the parameter list
  disambiguates overloads and same-named methods on different classes.
- The discriminator for an anonymous function-like entity (anonymous arrow function, anonymous
  function expression) is its 1-based `@line:column` position, since no stable name exists.
- Module entities use the bare project-relative path as their id (no segment chain).

Identity generation is isolated in `src/identity/entity-id.ts` behind plain functions (no
compiler-specific inputs), so a future scheme — content fingerprints, git-aware rename tracking —
can replace it without touching call sites.

**What determinism means in practice:** re-running `analyzeProject` against unchanged source and
configuration produces byte-equivalent `entities`, `relationships`, `evidence`, `files`, and
`diagnostics` arrays (all sorted by id/path), and equivalent `metrics`. The only field that
legitimately differs between runs is `result.run` (run id, timestamps, duration) — which is why it
is a distinct top-level field, separate from the semantic output, rather than interleaved with it.

## Diagnostics and partial results

Codara prefers partial results to total failure. A malformed `package.json`, a malformed
`tsconfig.json`, or a file with a syntax error each produce a `Diagnostic` (with a `code`,
`severity`, optional `filePath`/`location`, and `recoverable: true`) rather than aborting the run.
Sibling files that parse cleanly are still analyzed and included in the result.

## Privacy

All `filePath` values in `SourceLocation` and `SourceFileRecord` are project-relative, POSIX-style
paths. Absolute local filesystem paths are never embedded in the emitted model, including
`project.rootPath`, which is always `"."`.
