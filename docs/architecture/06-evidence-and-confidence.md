# Evidence and Confidence

> **Status:** Implemented in Phase 1. This document describes the actual evidence records emitted
> by `src/language/typescript/extract-entities.ts` and
> `src/language/typescript/resolve-module-relationships.ts`, and the diagnostics machinery in
> `src/discovery/*` and `src/model/diagnostic.ts`.

## The invariant

> No semantic claim should exist without traceable provenance.

Every entity and every relationship Codara emits carries an `evidenceIds` array pointing at one or
more `SemanticEvidence` records, and a `confidence` number. This is not decorative — it is how a
consumer distinguishes a fact Codara is certain of from one it is asserting more tentatively, and
how anyone auditing the output can trace a claim back to the exact source range or configuration
signal that produced it.

## Facts, inferences, confidence, and diagnostics — four different things

It's easy to conflate these; Codara keeps them structurally distinct:

- **A fact** is something read directly from source with no interpretation involved — "this file
  contains a class declaration named `WalletService` starting at line 12." Phase 1 entities are
  facts: `confidence: 1`, backed by a `syntaxDeclaration` evidence record.
- **An inference** is something derived by connecting facts, where the connection itself could be
  wrong or incomplete — "this import specifier resolves to that file in the inventory." Phase 1's
  relationship resolution is an inference: usually confident (`1`), but explicitly less so
  (`0.6`) when the target couldn't be located.
- **Confidence** is the number attached to a fact or inference expressing how much Codara trusts
  it. In Phase 1 this is a coarse, honest signal, not a calibrated probability — see
  [below](#confidence-in-phase-1-a-binary-signal-not-a-calibrated-score).
- **A diagnostic** is not a claim about the code at all — it's a report about the _analysis
  process itself_: "this file couldn't be parsed," "this configuration was malformed," "this many
  files were skipped." Diagnostics never carry `confidence`; they carry `severity` and
  `recoverable` instead. See [Diagnostics](#diagnostics).

## Evidence types available in Phase 1

```ts
export type SemanticEvidenceType =
  | "manifestSignal"
  | "configurationSignal"
  | "syntaxDeclaration"
  | "importBinding"
  | "sourceRange"
  | "namingHeuristic";

export interface SemanticEvidence {
  id: string;
  type: SemanticEvidenceType;
  subjectId: string; // the entity or relationship id this evidence supports
  location?: SourceLocation;
  confidence: number;
  details: Record<string, unknown>;
  explanation: string; // a plain-language reason, not just a machine code
}
```

Phase 1 actually emits three of the six defined types:

- **`syntaxDeclaration`** — backs every entity: "declared as `<kind>` in source," pointing at the
  entity's own location. This is parser/syntax evidence in its purest form — the entity exists
  because the AST contains this exact declaration node.
- **`sourceRange`** — backs every `contains` relationship: "derived from AST containment,"
  pointing at the child's source range within the parent.
- **`importBinding`** — backs every `imports`/`exports`/`reExports` relationship: records the
  specifier or exported name, and states in `explanation` whether the target was resolved or is
  "likely an external package or alias." This is module-resolution evidence.

`manifestSignal`, `configurationSignal`, and `namingHeuristic` are defined in the type union for a
future discovery-stage evidence trail (e.g. "detected React because it's a `dependencies` entry,"
or "classified as a probable test file by naming convention") but are **not yet emitted** — Phase
1's discovery stages currently report their findings as `Diagnostic`s (see below) rather than as
evidence records tied to a specific entity.

## Unresolved findings and reduced confidence

When an `imports`/`exports`/`reExports` relationship's target cannot be cheaply resolved (a bare
package specifier, a `tsconfig` path alias, a genuinely missing file), Codara does not omit the
relationship and does not fabricate a target — it emits the relationship with `targetId: undefined`
and `confidence: 0.6`, and an `importBinding` evidence record whose `explanation` says so
explicitly. This is the concrete mechanism behind the relationship-model principle "unresolved,
never guessed" described in [04-relationship-model.md](04-relationship-model.md#resolved-vs-unresolved-targets).

## Diagnostics

```ts
export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  filePath?: string;
  location?: SourceLocation;
  recoverable: boolean;
  details?: Record<string, unknown>;
}
```

Diagnostics are how Codara reports problems with the _analysis_, not claims about the code. Phase 1
emits diagnostics for, among others: a malformed `package.json` (`manifest-parse-error` /
`manifest-invalid-shape`), a malformed or unreadable `tsconfig.json`/`jsconfig.json`
(`tsconfig-read-error` / `tsconfig-parse-error`), a directory that could not be read
(`directory-read-error`), a file that could not be stat'd (`file-stat-error`), a file skipped for
being over the size budget (`file-too-large`), the file inventory being truncated at the file-count
budget (`file-count-limit-reached`), a file the compiler could not load (`file-not-parsed`), and
genuine syntax errors surfaced by `program.getSyntacticDiagnostics()` (reported with their original
`TS<code>` code).

`recoverable: true` on essentially all of the above reflects Codara's stance: prefer a partial
result to total failure. A syntax error in one file does not stop analysis of its siblings; a
malformed configuration falls back to permissive defaults rather than aborting. The library only
ever throws (rather than returning a diagnostic) for the one case where there is no project to
analyze at all — an invalid or inaccessible root (`CodaraInvocationError`; see
[08-public-api.md](08-public-api.md)).

## Confidence in Phase 1: a binary signal, not a calibrated score

It bears repeating plainly: Phase 1's `confidence` values are `1` (resolved / directly-observed)
or `0.6` (asserted but unresolved) — there is no gradient in between, and no statistical model
behind either number. A future phase that adds heuristic-based evidence (e.g. `namingHeuristic`)
would need genuinely graded confidence; Phase 1 does not need it because everything it currently
asserts is either a direct syntactic fact or a binary resolved/unresolved reference.

## Determinism

Determinism is the practical, testable expression of "traceable and explainable": if two runs over
identical source and configuration disagreed about what's true, the evidence trail would be
worthless. `src/output/normalize-result.ts` sorts `entities`/`relationships`/`evidence` by `id` and
`files` by `relativePath` before returning them, so array order never depends on filesystem
iteration order or processing order. Entity, relationship, and evidence ids are themselves
deterministic (see [03-semantic-entity-model.md#deterministic-ids](03-semantic-entity-model.md#deterministic-ids)),
built from stable project-relative paths and declaration shapes — never from timestamps, random
identifiers, or memory addresses.

The one place non-determinism is allowed to exist is `result.run` (`AnalysisRunSummary`): a run id,
start/finish timestamps, and duration. These legitimately differ between runs and are kept as a
distinct top-level field, separate from `entities`/`relationships`/`evidence`/`diagnostics`/
`metrics`, specifically so a test (or a consumer) can assert "these two runs produced an equivalent
semantic model" by comparing everything _except_ `run`. Codara's own integration test suite does
exactly this.

---

Previous: [05 — Behavior Model](05-behavior-model.md) · Next: [07 — Query and Context](07-query-and-context.md)
