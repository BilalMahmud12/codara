# Mental Model

> **Status:** Sections 1–3 (Project, Semantic Entity, Relationship) and the diagnostics/evidence
> facts described here are **implemented in Phase 1**. Sections 4 and 6 (Behavioral Model,
> Query/Context Model) are **planned only** — typed seams exist in source, nothing executes them
> yet. See each section's status line.

## Core worldview

> A software project is a graph of meaningful entities and relationships whose structures and
> behaviors can be recovered from source code through explicit evidence.

Codara treats a repository not as a folder of text files but as evidence from which a structured
model can be reconstructed: files contain entities, entities relate to one another, entities may
exhibit behaviors, and every one of those facts is only as trustworthy as the evidence backing it.
This document lays out the six models that give that worldview a concrete shape, and states plainly
which of them Phase 1 actually builds.

## The six models

### 1. Project Model — **implemented**

Describes the analysis boundary: what root was analyzed, what package/workspace signals were
found, what configuration applies, and what capabilities were available for this run (syntax
analysis, type analysis, symbol resolution, source maps, workspace detection). See
[02-project-discovery.md](02-project-discovery.md).

### 2. Semantic Entity Model — **implemented**

Describes meaningful structural units recovered from source: modules, classes, interfaces, type
aliases, enums, functions, methods, variables, imports, exports. Every entity carries a
deterministic id, a source location, containment via `parentId`, and a set of flags. See
[03-semantic-entity-model.md](03-semantic-entity-model.md).

### 3. Relationship Model — **implemented (partial kind set)**

Describes how entities connect: today, containment, imports, exports, and re-exports. A much
larger set of relationship kinds (calls, constructs, extends, implements, reads, writes) is
planned but not implemented, because those require symbol resolution or control-flow analysis
Phase 1 does not perform. See [04-relationship-model.md](04-relationship-model.md).

### 4. Behavioral Model — **planned seam only**

Describes what an entity actually _does_ when it runs: the observable outcomes a function or
method can produce (a return, a throw, a state mutation, an emitted event), each with its own
preconditions, effects, and confidence. `src/model/behavior.ts` defines the shape; nothing in
Phase 1 populates it. See [05-behavior-model.md](05-behavior-model.md).

### 5. Semantic Evidence and Confidence Model — **implemented**

Describes why Codara believes a given entity or relationship exists: a source-range declaration, a
resolved import binding, a configuration signal. Every entity and relationship carries
`evidenceIds` and a `confidence` value; nothing is asserted without at least one evidence record.
See [06-evidence-and-confidence.md](06-evidence-and-confidence.md).

### 6. Query and Context Model — **planned seam only**

Describes how a consumer would eventually ask the graph a question — "find this entity," "show its
callers," "give me a token-budgeted context bundle for this task" — and get back a bounded,
ranked answer instead of the entire model. `src/model/query.ts` defines the shape; no query
execution or context compilation exists yet. See [07-query-and-context.md](07-query-and-context.md).

## What Phase 1 actually builds

To be concrete about the boundary above: Phase 1 implements project discovery, the entity model,
the four structural relationship kinds, and the evidence/confidence/diagnostics machinery that
backs them. It does **not** implement behavior extraction or query/context execution — those are
typed seams reserved so that adding them later does not require a breaking change to
`CodaraAnalysisResult`. Diagnostics (recoverable, partial-result-producing findings such as a
malformed `tsconfig.json` or a syntax error in one file) are also part of the implemented Phase 1
surface; see [06-evidence-and-confidence.md](06-evidence-and-confidence.md) for how they relate to
evidence and confidence.

## Lifecycle

Conceptually, building the model for a repository moves through these stages:

```text
Discover
  → Normalize
    → Identify
      → Connect
        → Decompose
          → Observe
            → Assess confidence
              → Expose for query
```

| Stage             | Meaning                                                                      | Phase 1 status                                                                       |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Discover          | Find the project root, its manifest, its configuration, its files            | Implemented — [02-project-discovery.md](02-project-discovery.md)                     |
| Normalize         | Convert filesystem/compiler-specific data into stable, project-relative DTOs | Implemented — [08-public-api.md](08-public-api.md)                                   |
| Identify          | Assign deterministic ids to files and entities                               | Implemented — [03-semantic-entity-model.md](03-semantic-entity-model.md)             |
| Connect           | Derive containment, import, export, and re-export relationships              | Implemented (four kinds only) — [04-relationship-model.md](04-relationship-model.md) |
| Decompose         | Break an entity down into its observable behaviors                           | Planned only — [05-behavior-model.md](05-behavior-model.md)                          |
| Observe           | Record what evidence supports each fact                                      | Implemented — [06-evidence-and-confidence.md](06-evidence-and-confidence.md)         |
| Assess confidence | Attach a confidence value wherever certainty is incomplete                   | Implemented — [06-evidence-and-confidence.md](06-evidence-and-confidence.md)         |
| Expose for query  | Let a consumer ask the graph bounded, ranked questions                       | Planned only — [07-query-and-context.md](07-query-and-context.md)                    |

Phase 1 walks a repository through _Discover → Normalize → Identify → Connect → Observe → Assess
confidence_ and stops there, emitting the result as a single JSON artifact (see
[08-public-api.md](08-public-api.md)) rather than through a live query interface. _Decompose_ and
_Expose for query_ are the two stages later phases would add.

## A boundary worth restating

This mental model, and every document under `docs/architecture/`, describes Codara's own
structural and (eventually) behavioral understanding of code. It does not include, and must not
grow to include, test-intelligence concepts — test intent, assertion strength, mock/spy integrity,
coverage correlation, mutation analysis, or risk scoring. Those concepts belong to specialized
applications built as separate, private products on top of Codara's model (see
[00-vision.md](00-vision.md#the-engine--application-boundary)), never inside the open-source core.

---

Previous: [00 — Vision](00-vision.md) · Next: [02 — Project Discovery](02-project-discovery.md)
