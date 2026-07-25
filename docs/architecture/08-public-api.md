# Public API

> **Status:** Implemented in Phase 1. This document describes the actual library entry point
> (`src/index.ts`, `src/application/analyze-project.ts`) and CLI (`src/cli/index.ts`), matched
> against the generated `.d.ts` declarations in `dist/`. No method or flag described here is
> aspirational.

## Library entry point

```ts
export async function analyzeProject(options: AnalyzeProjectOptions): Promise<CodaraAnalysisResult>;

export interface AnalyzeProjectOptions {
  root: string;
  outputFile?: string | false;
  include?: string[];
  exclude?: string[];
  resourceBudget?: Partial<ResourceBudget>;
}
```

This is the entire public function surface of the library — `analyzeProject` is the only exported
function. Everything else exported from the package's root (`import { ... } from "codara"`) is a
type: the full `CodaraAnalysisResult` DTO tree (`SemanticEntity`, `SemanticRelationship`,
`SemanticEvidence`, `Diagnostic`, `ProjectSummary`, etc. — see
[03](03-semantic-entity-model.md)/[04](04-relationship-model.md)/[06](06-evidence-and-confidence.md)),
plus `CodaraInvocationError`, plus the seam types from the Behavioral and Query/Context models
(exported so consumers can reference them, even though nothing produces values of those types yet).

### Root behavior

`options.root` may be relative or absolute; it is resolved to an absolute path internally
(`node:path`'s `resolve`) before validation. A root that does not exist, or exists but is not a
directory, causes `analyzeProject` to reject with a `CodaraInvocationError` (`root-not-found` /
`root-not-directory`) — this is the only case in which the library rejects rather than returning a
result with diagnostics, because there is no project to describe. See
[02-project-discovery.md](02-project-discovery.md#1-root-validation-and-session-creation).

### Output behavior

`outputFile` defaults to `.codara/analysis.json` (relative to `root`) when omitted. Passing an
explicit string writes there instead (absolute paths are used as-is; relative paths are resolved
against `root`). Passing `false` skips writing entirely — `analyzeProject` still returns the full
result, it just isn't persisted. Parent directories are created as needed.

### Resource-budget seams

```ts
export interface ResourceBudget {
  maxMemoryMb?: number;
  maxWorkers?: number;
  maxFileSizeBytes?: number;
  maxFiles?: number;
}
```

`maxFileSizeBytes` (default 5 MiB) and `maxFiles` (default 20,000) are enforced today — see
[02-project-discovery.md](02-project-discovery.md#6-controlled-file-inventory). `maxMemoryMb` and
`maxWorkers` are defined on the type (per the product spec's requirement to define, but not
necessarily enforce, the full resource-budget seam in Phase 1) but are not read or enforced by any
code path yet — see [09-runtime-and-performance.md](09-runtime-and-performance.md).

### Diagnostics

Every recoverable problem — a malformed manifest, a malformed `tsconfig.json`, a file that failed
to parse, a syntax error — is returned in `result.diagnostics`, never thrown. See
[06-evidence-and-confidence.md#diagnostics](06-evidence-and-confidence.md#diagnostics).

### Deterministic ordering

`result.files`, `result.entities`, `result.relationships`, `result.evidence`, and
`result.diagnostics` are always sorted the same way for the same input — see
[06-evidence-and-confidence.md#determinism](06-evidence-and-confidence.md#determinism). The only
field that legitimately varies between identical runs is `result.run`.

### Serializable DTO guarantee

`CodaraAnalysisResult` and everything nested inside it is plain, JSON-serializable data — no
`ts.Node`, `ts.Symbol`, `ts.Type`, `ts.SourceFile`, or `ts.Program` ever appears anywhere in it. See
[03-semantic-entity-model.md#why-compiler-specific-objects-never-cross-the-public-boundary](03-semantic-entity-model.md#why-compiler-specific-objects-never-cross-the-public-boundary).

### Absence of `process.exit`

Nothing under `src/application/*`, `src/discovery/*`, `src/language/*`, `src/model/*`,
`src/identity/*`, `src/output/*`, or `src/shared/*` calls `process.exit` or sets
`process.exitCode`. The library only ever returns a promise that resolves or rejects — how a host
process reacts to that is entirely up to the caller. `process.exitCode` is set in exactly one file
in this repository: `src/cli/index.ts`.

## CLI

```text
codara analyze [root] [--output <path>] [--no-write]
```

- `root` — defaults to the current working directory (`.`) when omitted.
- `--output <path>` — writes the analysis JSON to a custom path instead of the default
  `.codara/analysis.json`.
- `--no-write` — skip writing to disk; only print the console summary.
- `--version` — print `schemaVersion=<...> engineVersion=<...>` and exit `0`.
- `--help` / `-h` — print usage and exit `0`.

### CLI ownership of exit codes

The CLI is the only place `process.exitCode` is set:

- `0` — analysis completed (even if `result.diagnostics` contains warnings or recoverable errors —
  see [06-evidence-and-confidence.md#diagnostics](06-evidence-and-confidence.md#diagnostics); those
  are not fatal).
- `1` — a `CodaraInvocationError` was thrown (invalid root, malformed CLI arguments such as a
  missing `--output` value or an unrecognized flag), or an unexpected error propagated out of
  `analyzeProject`, or no subcommand was given at all.

The console summary printed on success is produced by `src/cli/render-summary.ts` and mirrors the
format shown in the [README](../../README.md#output-example): project name, module system,
file/entity counts by kind, diagnostic counts, and the output path (or a note that `--no-write` was
used).

## Current output file default

`.codara/analysis.json`, relative to the resolved root — both from the library (via
`AnalyzeProjectOptions.outputFile`'s default) and from the CLI (via the same constant, duplicated
deliberately in `src/cli/index.ts` since the library never assumes a CLI is calling it).

## Current package entry points and exports

From `package.json`:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "bin": {
    "codara": "./dist/cli/index.js"
  }
}
```

The package is pure ESM (`"type": "module"`), has exactly one export path (`"."` — the library
entry point), and one CLI binary (`codara`, mapped to the built CLI entry point). There is no
`"./package.json"` export map entry, no subpath exports, and no CommonJS build — a consumer must be
able to `import` (not `require`) this package.

## Schema versioning

`CodaraAnalysisResult.schemaVersion` and `.engineVersion` are both present on every result
(currently `"1.0.0"` and `"0.1.0"` respectively, defined as constants in
`src/application/analyze-project.ts`). Per the product spec's API rules, a breaking change to the
shape of `CodaraAnalysisResult` requires bumping `schemaVersion`; `engineVersion` tracks the
package's own release version independently of schema compatibility.

---

Previous: [07 — Query and Context](07-query-and-context.md) · Next: [09 — Runtime and Performance](09-runtime-and-performance.md)
