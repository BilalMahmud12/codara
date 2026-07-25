# Runtime and Performance

> **Status:** Sections marked "current" describe what's implemented today
> (`package.json`, `tsup.config.ts`, `src/discovery/*`, `src/output/normalize-result.ts`). Sections
> marked "future" are performance/scalability principles carried over from the product
> specification that Phase 1 does not yet need to implement.

## Current: why TypeScript 6.0.3 is pinned

The product specification calls for using the TypeScript Compiler API directly. At the time Phase 1
was implemented, the `typescript` version already present in the repository resolved to `7.0.2` —
the native/Go-rewritten compiler line, which does not expose the classic JS-based Compiler API at
all (`ts.createProgram`, `ts.createSourceFile`, `ts.SyntaxKind`, and everything else
`src/language/typescript/*` depends on, are simply `undefined` on that package). `6.0.3` is the
newest release that still ships the full classic API Phase 1 is built on, so `package.json` pins it
exactly (`"typescript": "6.0.3"`, not a caret range) rather than letting an automatic upgrade
silently move the project onto a version without the API it needs.

## Current: why TypeScript is a runtime dependency

`typescript` is listed under `"dependencies"`, not `"devDependencies"`. It is not a build-time-only
tool here — `src/discovery/resolve-configuration.ts` and every file under
`src/language/typescript/*` `import ts from "typescript"` and call it at analysis time, in the
published package, not just during Codara's own build. Treating it as a dev dependency would be
incorrect: a consumer installing `codara` from a registry would get a package that throws at
runtime because its actual runtime dependency was never installed.

## Current: the adapter boundary around the compiler

All `ts.*` usage is confined to `src/language/typescript/*` (`create-program.ts`,
`extract-entities.ts`, `resolve-module-relationships.ts`, `syntax-diagnostics.ts`,
`syntax-kind-mapping.ts`) and one discovery module (`resolve-configuration.ts`, which needs
`ts.readConfigFile`/`ts.parseJsonConfigFileContent` to interpret `tsconfig.json`). Nothing in
`src/model/*`, `src/index.ts`, `src/cli/*`, `src/output/*`, or `src/application/analyze-project.ts`
imports `typescript` directly for its compiler surface — `analyze-project.ts` only passes already-
resolved `ts.CompilerOptions` values between discovery and the adapter, and only ever receives back
plain `SemanticEntity`/`SemanticRelationship`/`SemanticEvidence`/`Diagnostic` objects from it. This
is the practical enforcement of the principle described in
[03-semantic-entity-model.md#why-compiler-specific-objects-never-cross-the-public-boundary](03-semantic-entity-model.md#why-compiler-specific-objects-never-cross-the-public-boundary):
a future language adapter for another ecosystem could, in principle, replace everything under
`language/typescript/` while every other layer stays unchanged, because nothing else layer depends
on `ts.*` shapes.

## Current: why TypeScript is externalized from the build

`tsup.config.ts` bundles `src/index.ts` and `src/cli/index.ts` to ESM with declaration files. Since
`typescript` is a real runtime dependency (see above), tsup treats it as external by default rather
than inlining it into the bundle — this was verified directly during implementation: with
`typescript` mistakenly left in `devDependencies`, the build inlined the entire compiler and
produced a ~9.5 MB bundle; moving it to `dependencies` dropped the built output to roughly 46–51 KB
per entry point. Bundling a dependency the host environment will install anyway is wasted size for
no benefit.

## Current: resource limits

`inventoryFiles` enforces two budgets today (see
[02-project-discovery.md#6-controlled-file-inventory](02-project-discovery.md#6-controlled-file-inventory)):

- `maxFileSizeBytes` (default 5 MiB) — a file over this size is recorded in the inventory but
  marked `shouldParse: false` with `exclusionReason: "file-too-large"`, rather than read into the
  compiler.
- `maxFiles` (default 20,000) — the walk stops adding new files once this many have been
  collected, emitting a single `file-count-limit-reached` diagnostic rather than continuing
  silently or running unbounded.

Both are configurable via `AnalyzeProjectOptions.resourceBudget`. `maxMemoryMb` and `maxWorkers` are
defined on the same `ResourceBudget` type but are not read by any code path — see
[08-public-api.md#resource-budget-seams](08-public-api.md#resource-budget-seams). This matches the
product specification's allowance to define, but not necessarily strictly enforce, memory/worker
budgets in Phase 1.

## Current: default-exclusion strategy

Default-excluded directory names (`.git`, `node_modules`, `dist`, `build`, `out`, `coverage`,
`.nyc_output`, common caches, `.codara` itself) are never descended into during the file walk —
this is a directory-name check applied before `readdir` recurses, not a post-hoc filter applied
after reading a large subtree. The practical effect is that a `node_modules` directory with tens of
thousands of files never gets listed at all, which is a large part of why Phase 1's walk stays fast
without needing worker-thread parallelism (see [Future: bounded parallelism](#future-bounded-parallelism)
below).

## Current: deterministic normalization

Covered in detail in
[06-evidence-and-confidence.md#determinism](06-evidence-and-confidence.md#determinism). Relevant
here specifically as a performance/architecture property: normalization (sorting + metrics
computation) is a single pass over already-collected arrays at the end of analysis
(`src/output/normalize-result.ts`), not something threaded through every extraction step — it is
cheap, and it is the only place ordering is decided, so no other stage needs to worry about
producing output in a canonical order.

## Future: memory-management principles

The specification's stance for later phases is that the persisted, returned model should stay
**compact** — ids, relative paths, source ranges, flags, relationship edges, and evidence
references — and should not retain rich, cyclic, or compiler-attached objects. Phase 1 already
satisfies this by construction (see [the adapter boundary](#current-the-adapter-boundary-around-the-compiler)
above); it is listed here as a principle later phases must continue to respect as new data
(behaviors, richer relationships) is added, not as something Phase 1 had to work to achieve beyond
keeping DTOs plain.

## Future: staged analysis

The specification describes a staged pipeline — discover → inventory → shallow parse → persist
compact index → deepen selectively in later phases — as the general shape scalability should take:
don't run the most expensive analysis on every file immediately. Phase 1 already reflects the first
half of this (cheap reconnaissance before any parsing; classification before parsing; parsing
before relationship resolution). The "deepen selectively" half — e.g. only running future behavior
extraction on entities a consumer actually queried for, rather than on everything up front — is a
future-phase concern with no implementation yet, since query/context execution itself doesn't
exist (see [07-query-and-context.md](07-query-and-context.md)).

## Future: disposable deep-analysis structures

Related to the point above: if a future phase performs genuinely deep, per-entity analysis (e.g.
control-flow decomposition for the Behavioral Model), the intermediate compiler/analysis structures
used for that one entity should be releasable once its compact result is extracted, rather than
held for the lifetime of the whole run. Phase 1's own `ts.Program` and parsed `SourceFile`s are
already not retained in the returned result (see the adapter-boundary section above); a future
phase doing heavier per-entity work would need to preserve that same discipline at a finer grain.

## Future: bounded parallelism

The specification allows Phase 1 to skip worker-thread complexity "unless measurement proves it
beneficial," and Phase 1 does skip it: file inventory, parsing, and extraction all run on the main
thread, sequentially per file. This is a deliberate simplicity choice, not an oversight — introducing
worker-thread orchestration is also an explicit Phase 1 non-goal (see
[CODARA_ENGINE_CONCEPT_AND_PHASE1.md](../../CODARA_ENGINE_CONCEPT_AND_PHASE1.md), §12). If a future
phase needs concurrency for larger repositories, the specification's cautions still apply: avoid
loading one complete `ts.Program` per worker, avoid duplicating the semantic graph across workers,
and avoid serializing compiler AST objects across a worker boundary — workers, if ever introduced,
should exchange the same compact DTOs Phase 1 already produces, not compiler internals.

## Future: incremental analysis

Re-analyzing an entire repository from scratch on every invocation is the correct behavior for
Phase 1 (and the only behavior needed for a deterministic, from-scratch model), but is not the only
behavior a mature tool would want — a future phase could cache per-file results keyed by content
hash and only re-extract files that actually changed. No caching of any kind exists today; every
`analyzeProject` call performs a full walk and full parse. An incremental cache is also an explicit
Phase 1 non-goal per the product specification, listed here only as a plausible future direction.

## Current: runtime neutrality and avoidance of Bun-specific APIs

Codara targets Node.js (`package.json` `engines.node: ">=18.18"`; `tsup.config.ts` builds for
`target: "node18"`, `platform: "node"`). No file under `src/` references a Bun-specific global or
API (`Bun.*`, `bun:*` imports) — all filesystem, path, and process access goes through Node's
`node:fs`, `node:fs/promises`, `node:path`, `node:crypto`, and `node:url` built-ins. This is a
deliberate constraint, not an accident of what happened to be convenient: avoiding a Bun-specific
runtime dependency is an explicit requirement so the published package behaves identically for any
consumer on a standard Node.js installation.

---

Previous: [08 — Public API](08-public-api.md) · Back to: [Architecture index](README.md)
