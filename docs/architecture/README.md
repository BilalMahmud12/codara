# Codara Architecture Documentation

This is the architecture documentation set for Codara. It explains _why_ Codara is built the way
it is, in more depth than [the project README](../../README.md) or
[docs/semantic-model.md](../semantic-model.md), which describe _how to use_ Phase 1. The
authoritative product and scope specification remains
[CODARA_ENGINE_CONCEPT_AND_PHASE1.md](../../CODARA_ENGINE_CONCEPT_AND_PHASE1.md); this set expands
on it and cross-references the actual source where relevant, but does not supersede it.

## Implemented vs. planned

Codara's long-term design has six connected conceptual models (see
[01-mental-model.md](01-mental-model.md)). Phase 1 — the only phase implemented in this repository
today — builds three of them fully, one partially, and leaves two as typed seams only:

| Document                                                       | Describes                                                  | Status                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| [00-vision.md](00-vision.md)                                   | Purpose, problem, consumers, engine/application boundary   | Direction, not a capability claim      |
| [01-mental-model.md](01-mental-model.md)                       | The six models and the analysis lifecycle                  | Mixed — marked per section             |
| [02-project-discovery.md](02-project-discovery.md)             | Root validation → file inventory → classification pipeline | **Implemented**                        |
| [03-semantic-entity-model.md](03-semantic-entity-model.md)     | Entity kinds, ids, flags, containment                      | **Implemented**                        |
| [04-relationship-model.md](04-relationship-model.md)           | `contains`/`imports`/`exports`/`reExports`                 | **Implemented** (narrow kind set)      |
| [05-behavior-model.md](05-behavior-model.md)                   | Observable outcomes of an entity                           | **Planned only** — seam, no extraction |
| [06-evidence-and-confidence.md](06-evidence-and-confidence.md) | Provenance, confidence, diagnostics                        | **Implemented**                        |
| [07-query-and-context.md](07-query-and-context.md)             | Querying the graph, AI context bundles                     | **Planned only** — seam, no execution  |
| [08-public-api.md](08-public-api.md)                           | `analyzeProject`, the CLI, package exports                 | **Implemented**                        |
| [09-runtime-and-performance.md](09-runtime-and-performance.md) | Compiler pinning, adapter boundary, resource limits        | Mixed — marked per section             |

**Read this warning before treating any of these documents as a feature list:**
[05-behavior-model.md](05-behavior-model.md) and [07-query-and-context.md](07-query-and-context.md)
are **design contracts for future phases**, not claims that the described capability exists today.
Every code reference in them (`src/model/behavior.ts`, `src/model/query.ts`) is to a typed seam —
an interface shape reserved so a later phase can be added without a breaking schema change —
not to working logic. If you are evaluating what Codara can do _right now_, trust the "Implemented"
rows above and the [root README](../../README.md)'s "What Phase 1 supports" /
"What Phase 1 explicitly does not support" sections over any narrative description of a future
model.

## Reading order

The documents are numbered for a reason — each one assumes the previous ones. Suggested order:

1. **[00-vision.md](00-vision.md)** — why Codara exists at all, and where its boundary with
   downstream/proprietary applications sits.
2. **[01-mental-model.md](01-mental-model.md)** — the six-model worldview and the discover-to-query
   lifecycle, with an explicit implemented/planned split for each stage.
3. **[02-project-discovery.md](02-project-discovery.md)** — the concrete, implemented pipeline that
   turns a repository into a `ProjectSummary` and a file inventory.
4. **[03-semantic-entity-model.md](03-semantic-entity-model.md)** — what gets extracted from each
   parsed file, and how entity identity works.
5. **[04-relationship-model.md](04-relationship-model.md)** — how extracted entities get connected.
6. **[05-behavior-model.md](05-behavior-model.md)** — the planned next layer beyond structure
   (skip this if you only care about what exists today).
7. **[06-evidence-and-confidence.md](06-evidence-and-confidence.md)** — the provenance rules that
   apply to everything in documents 2–5.
8. **[07-query-and-context.md](07-query-and-context.md)** — the planned consumption layer on top of
   the graph (skip this if you only care about what exists today).
9. **[08-public-api.md](08-public-api.md)** — how to actually call any of this, as a library or a
   CLI.
10. **[09-runtime-and-performance.md](09-runtime-and-performance.md)** — the runtime constraints
    (TypeScript version pinning, the compiler adapter boundary, resource limits) and the
    performance principles later phases are expected to keep respecting.

If you only want to know what Codara can do today, the fastest path is
[02](02-project-discovery.md) → [03](03-semantic-entity-model.md) → [04](04-relationship-model.md)
→ [08](08-public-api.md), skipping [05](05-behavior-model.md) and [07](07-query-and-context.md)
entirely.

## Relationship to other documentation

- [CODARA_ENGINE_CONCEPT_AND_PHASE1.md](../../CODARA_ENGINE_CONCEPT_AND_PHASE1.md) — the original
  product and scope specification. Authoritative for scope decisions; this architecture set
  explains and cross-references it but does not override it.
- [PHASE1_EXECUTION_REPORT.md](../../PHASE1_EXECUTION_REPORT.md) — a historical record of how
  Phase 1 was implemented, including bugs found and fixed along the way. Useful for understanding
  _why_ certain implementation choices were made; not a design document itself.
- [docs/semantic-model.md](../semantic-model.md) — a more compact, usage-oriented companion to
  documents [03](03-semantic-entity-model.md), [04](04-relationship-model.md), and
  [06](06-evidence-and-confidence.md) in this set. Where the two overlap, they are kept consistent
  with each other and with `src/model/*`; if a discrepancy is ever found, the source is
  authoritative over both.
- [README.md](../../README.md) — the project's front door: installation, library/CLI usage
  examples, and the canonical "what Phase 1 supports / does not support" lists.
