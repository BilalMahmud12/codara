# Vision

> **Status:** Describes Codara's purpose and direction. The "what exists today" claims in this
> document are limited to Phase 1; everything else is direction, not a shipped capability.

## The problem

Every tool that works with a codebase — an editor, a linter, an AI coding agent, a documentation
generator, a change-impact script — starts from the same disadvantage: it does not know what the
project _is_. It has to rediscover the project's structure from scratch, every time, usually
through one of two shallow mechanisms:

- **Raw text search** (grep, full-text indexes) finds strings, not structure. It cannot tell a
  class declaration from a comment that happens to mention the class's name, cannot answer "what
  does this module export," and has no concept of containment, identity, or confidence.
- **Ordinary AST extraction**, run ad hoc inside whatever tool needs it, rebuilds a parse tree
  every time, in memory, with no shared identity scheme, no persistence, and no way for a second
  tool to reuse the first tool's work. Two tools analyzing the same repository independently will
  produce two incompatible, non-comparable views of it.

Neither approach produces something a project can _keep_ — a stable, inspectable, shareable
representation that survives past a single tool invocation.

## The idea

Codara's purpose is to give a JavaScript/TypeScript repository a **persistent semantic
representation** of itself: a deterministic, versioned, on-disk model of the entities the project
contains and the relationships between them, built once by walking the source and reusable by any
number of downstream consumers without re-parsing.

This representation is:

- **Deterministic** — the same source and configuration always produce the same model.
- **Traceable** — every fact in the model points back to the evidence that produced it (a source
  range, a declaration, a resolved import), so nothing is asserted without a reason.
- **Explicit about uncertainty** — where something cannot be resolved cheaply and reliably (a path
  alias, a dynamically computed import), Codara records that it does not know, rather than
  guessing.
- **Local** — the model is built entirely on the machine running the analysis; nothing is
  uploaded, and no network access is required.

## Who this is for

Codara itself is infrastructure, not an end-user tool. It is meant to be depended on by:

- **Architecture and navigation tools** that want to answer "what does this project contain" and
  "how is it organized" without re-parsing on every query.
- **AI context tooling** that needs a compact, structured map of a repository to decide what to
  read, instead of blindly feeding raw files into a context window.
- **Documentation generators** that want a reliable structural inventory (modules, classes,
  exports) as an input, rather than re-implementing a parser.
- **Change-impact analysis** that wants to know what a module exports and who imports it, as a
  starting point for reasoning about the blast radius of a change.
- **Specialized test-intelligence applications** — built as separate, independent products on top
  of Codara's structural model, not as part of Codara itself (see below).

Phase 1 delivers the discovery and structural layer these consumers need to exist; it does not yet
implement the query/context-serving layer such consumers would eventually call into (see
[07-query-and-context.md](07-query-and-context.md)).

## What Codara is not

- Codara is not a linter, and not a fixed collection of style rules.
- Codara is not a test-coverage tool, and not a replacement for Istanbul, Jest, Vitest, or
  mutation-testing tools.
- Codara is not a test-quality or test-adequacy scoring system.
- Codara is not a vector database or an embeddings/text-similarity search tool.
- Codara is not an LLM, and does not call one.
- Codara is not a code generator.
- Codara does not claim to resolve arbitrary dynamic JavaScript behavior statically — where static
  analysis genuinely cannot know something, the model says so instead of guessing.
- Codara does not upload source code to a remote service.

Phase 1, specifically, only performs structural discovery: it maps what entities a project
contains and how modules relate to one another through imports and exports. It does not yet
describe what those entities _do_ — see [05-behavior-model.md](05-behavior-model.md) for that
boundary.

## The engine / application boundary

Codara is deliberately split into two products with a one-way dependency:

```text
┌──────────────────────────────────────────────┐
│ Codara — open-source semantic foundation      │
│                                                │
│ Project discovery                             │
│ Entity and relationship modeling              │
│ (planned) Behavior extraction                 │
│ (planned) Semantic evidence and confidence     │
│ (planned) Query API and context compilation   │
└──────────────────────┬─────────────────────────┘
                        │ public package dependency
                        ▼
┌──────────────────────────────────────────────┐
│ Specialized applications — private            │
│                                                │
│ e.g. deep test-intent modeling, coverage      │
│ correlation, mutation analysis, risk scoring, │
│ CI policy, or any other proprietary use of    │
│ the Codara model                              │
└──────────────────────────────────────────────┘
```

Codara describes what software contains and, eventually, what it may do. It does not evaluate
whether tests adequately protect that behavior, whether a change is risky, or any other judgment
that belongs to a specialized consumer. The dependency direction is one-way: Codara never imports
from, and has no knowledge of, any application built on top of it. This document does not describe
any such application's business logic — that is out of scope for the open-source engine by design.

---

Next: [01 — Mental Model](01-mental-model.md) — the conceptual models Codara is built around, and
which of them Phase 1 actually implements.
