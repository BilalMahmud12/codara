# Codara

Codara is an open-source, deterministic semantic foundation for understanding JavaScript and
TypeScript codebases. It discovers a project, builds a compact structural inventory of its code,
and emits a traceable semantic JSON model — a reusable map of the project that other tools,
scripts, or AI agents can consume instead of re-reading raw source on every task.

This repository currently implements **Phase 1** of Codara:

> Codara discovers an unknown JavaScript or TypeScript project, builds a deterministic compact
> inventory of its structural entities and basic module relationships, and emits a traceable
> semantic JSON model.

Codara is infrastructure, not an application. It does not decide whether tests are good, whether
code is safe to ship, or whether a change is risky — those are the responsibilities of specialized
consumers built on top of Codara.

## What Phase 1 supports

- Root validation and an analysis session for a single-package JS/TS repository.
- Cheap, non-recursive root reconnaissance (`package.json`, `tsconfig.json`/`jsconfig.json`,
  lockfiles, notable directories).
- `package.json` interpretation: name, version, module type, scripts, dependencies, workspaces.
- `tsconfig.json` / `jsconfig.json` discovery and interpretation (`allowJs`, `jsx`, `paths`,
  module/module-resolution settings, project references).
- Workspace/monorepo **signal detection** and member-candidate reporting, without full
  multi-package semantic analysis.
- A controlled file inventory with safe default exclusions (`.git`, `node_modules`, `dist`,
  `build`, `out`, `coverage`, `.nyc_output`, common caches and generated output) and support for
  user `include`/`exclude` glob patterns.
- File classification: production source, probable test source, configuration, declaration,
  generated, build output, fixture, script, or unknown.
- Shallow parsing of `.js`, `.jsx`, `.ts`, and `.tsx` files via the TypeScript Compiler API.
- A compact structural entity inventory: modules, classes, interfaces, type aliases, enums,
  constructors, methods, getters, setters, function declarations, arrow functions, function
  expressions, object methods (where practical), top-level variables, import declarations, and
  export declarations — with source ranges, parent/child containment, and flags such as
  `exported`, `async`, `static`, and visibility.
- Basic, reliably-derived relationships: containment, imports, exports, and re-exports (relative
  specifiers are resolved to sibling files when possible; unresolved specifiers — bare package
  names, path aliases — are recorded with reduced confidence rather than guessed).
- Semantic evidence records explaining why each entity/relationship was derived.
- Diagnostics with partial-result behavior: malformed manifests, malformed `tsconfig.json`, and
  syntax errors in individual files produce diagnostics without aborting the whole run.
- Deterministic entity IDs and array ordering, with volatile run metadata (run id, timestamps,
  duration) kept separate from the semantic output.
- A canonical JSON artifact and a concise console summary.

## What Phase 1 explicitly does not support

Codara is not a test-intelligence, coverage, or reporting product. Phase 1 deliberately does not
implement:

- Deep test discovery, test-intent modeling, or assertion/mock/spy/fixture analysis
- Coverage ingestion (Istanbul/V8/LCOV) or test-adequacy/risk scoring
- Mutation testing
- HTML/PDF reports or CI/CD gates
- A full symbol-resolved call graph or interprocedural control-flow/data-flow analysis
- Behavior extraction (the Behavioral Model is a documented seam, not an implementation)
- Semantic queries or an AI context compiler (the Query/Context Model is a documented seam)
- Embeddings or any LLM/AI integration
- Framework-specific plugins, an incremental cache, or git history analysis
- Worker-thread orchestration, Bun-specific APIs, multi-language adapters, or full monorepo
  analysis
- Publishing to a registry, or creating/pushing a remote repository

See [docs/semantic-model.md](docs/semantic-model.md) for how the public model is organized and
which parts are deliberately left as seams for later phases, and
[docs/architecture/](docs/architecture/README.md) for the full architecture documentation set.

## Installation / development

Requires Node.js 18.18+ and npm.

```bash
npm install
npm run build       # bundle the library and CLI into dist/
npm test            # run the unit and integration test suite
npm run lint         # eslint
npm run format:check # prettier --check
npm run typecheck    # tsc --noEmit
npm run smoke        # build, then run the CLI against this repository with --no-write
```

## Library usage

```ts
import { analyzeProject } from "codara";

const result = await analyzeProject({
  root: process.cwd(),
  outputFile: ".codara/analysis.json", // pass false to skip writing to disk
  include: ["src/**/*.ts"], // optional
  exclude: ["**/*.generated.ts"], // optional
});

console.log(result.metrics.entityCountsByKind);
```

`analyzeProject` never calls `process.exit` and never touches the network. It returns a fully
serializable `CodaraAnalysisResult` — plain DTOs only; TypeScript compiler objects (`ts.Node`,
`ts.Symbol`, `ts.Type`, `SourceFile`, `Program`) never appear in the public API.

## CLI usage

```bash
# Analyze the current directory, writing .codara/analysis.json
npx codara analyze .

# Analyze a specific root and write to a custom path
npx codara analyze ./my-project --output ./reports/codara.json

# Analyze without writing to disk (prints the console summary only)
npx codara analyze . --no-write
```

The CLI returns a nonzero exit code only for fatal invocation/analysis failures (e.g. an
inaccessible root). Ordinary diagnostics — syntax errors in individual files, a malformed
`tsconfig.json` — are reported but do not fail the run, since Codara prefers partial results over
total failure.

## Output example

Console summary:

```text
Codara Phase 1

Project: wallet-service
Root: /workspace/wallet-service
Module system: ESM

Files discovered: 92
Files analyzed: 72
Production files: 58
Probable test files: 14

Entities:
  Classes: 18
  Interfaces: 9
  Functions: 43
  Methods: 126
  Other: 37

Diagnostics: 3 warnings, 0 errors
Output: .codara/analysis.json
```

JSON artifact (`.codara/analysis.json`), abbreviated:

```json
{
  "schemaVersion": "1.0.0",
  "engineVersion": "0.1.0",
  "run": {
    "runId": "...",
    "startedAt": "...",
    "finishedAt": "...",
    "durationMs": 42,
    "mode": "standard"
  },
  "project": {
    "id": "project:wallet-service@1.0.0",
    "rootPath": ".",
    "moduleSystem": "esm",
    "...": "..."
  },
  "files": [
    { "relativePath": "src/wallet.ts", "classification": "productionSource", "...": "..." }
  ],
  "entities": [{ "id": "src/wallet.ts::class:WalletService", "kind": "class", "...": "..." }],
  "relationships": [{ "kind": "imports", "sourceId": "src/index.ts", "targetId": "src/wallet.ts" }],
  "evidence": [{ "type": "syntaxDeclaration", "...": "..." }],
  "diagnostics": [],
  "metrics": { "filesDiscovered": 92, "...": "..." }
}
```

`result.run` holds volatile, per-invocation metadata (run id, timestamps, duration). Everything
else is the deterministic semantic output: re-running analysis on unchanged source and
configuration produces an equivalent result once `run` is excluded from the comparison.

## Privacy / local-analysis statement

Codara runs entirely on your local machine:

- No network calls are made during analysis.
- No telemetry is collected.
- Source code is never uploaded anywhere.
- All paths in the output are normalized to project-relative, POSIX-style paths — absolute local
  filesystem paths are not embedded in the result.
- The only artifact written to disk is the JSON file you asked for (default
  `.codara/analysis.json`), which you control and can inspect.
