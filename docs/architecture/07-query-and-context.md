# Query and Context Model

> **Status: planned only. Query execution is not implemented. Context compilation is not
> implemented.** `src/model/query.ts` defines the shapes below as a typed seam — reserved so the
> public API surface will not need a breaking redesign when this work begins — but no code
> executes a `SemanticQuery`, and no code produces a `ContextBundle`. The "example requests and
> responses" below are illustrative of future direction; they are not current API guarantees, and
> none of the example output shapes should be assumed stable.

## The problem this model would solve

Phase 1 emits the entire analyzed model as one JSON artifact. That is sufficient for a consumer
that wants everything, but not for a consumer that wants a small, specific answer — "where is
`WalletService.debit` defined," "what does `src/index.ts` export," "give me a 5,000-token bundle of
context relevant to fixing a bug in wallet debits." Answering questions like that efficiently, over
a potentially large model, without re-scanning the entire result every time, is what the Query and
Context Model is for. It does not exist yet.

## Planned concepts

### Locating entities

A `SemanticQuery` would let a consumer select entities by id, name, or kind, rather than filtering
`CodaraAnalysisResult.entities` by hand:

```ts
export interface EntitySelector {
  id?: string;
  name?: string;
  kind?: string;
}

export interface SemanticQuery {
  entity?: EntitySelector;
  relationships?: RelationshipSelector[];
  depth?: number;
  filters?: QueryFilter[];
}
```

### Traversing relationships / asking for callers and dependencies

```ts
export interface RelationshipSelector {
  kind: RelationshipKind; // e.g. "imports", and eventually "calls"
  direction?: "incoming" | "outgoing";
}
```

A `RelationshipSelector` with `direction: "incoming"` and `kind: "imports"` would conceptually
answer "who imports this module" — the reverse of what's directly stored in
`SemanticRelationship.sourceId → targetId`. Note that genuinely useful "callers" queries depend on
the `calls` relationship kind, which itself does not exist yet (see
[04-relationship-model.md](04-relationship-model.md#planned-relationship-categories-not-implemented));
the Query Model's traversal mechanics and the Relationship Model's available edge kinds are
separate, and both need to exist for this to be useful in practice.

### Retrieving bounded semantic context / token-budgeted AI context compilation

```ts
export type ContextFacet = "entities" | "relationships" | "evidence" | "sourceRanges";

export interface ContextRequest {
  task: string;
  tokenBudget: number;
  include: ContextFacet[];
}

export interface ContextBundle {
  primaryEntities: SemanticEntity[];
  relatedEntities: RankedEntity[];
  facts: SemanticFact[];
  sourceRanges: SourceRangeReference[];
  diagnostics: Diagnostic[];
  estimatedTokens: number;
}
```

The idea: a consumer describes a task in natural language and a token budget, and gets back a
ranked, bounded slice of the model — not the whole graph — sized to fit that budget. This is the
concept referenced in [00-vision.md](00-vision.md#who-this-is-for) under "AI context tooling."
Nothing about ranking, token estimation, or natural-language task interpretation is designed yet
beyond this shape.

### Impact-oriented context bundles

A specific anticipated use of `ContextRequest`/`ContextBundle`: given a task like "assess the
impact of changing `WalletService.debit`," a future implementation would use relationship
traversal (once `calls`/`dependsOn` exist) to find affected entities and bundle just those, plus
their source ranges, into a response — instead of a consumer manually walking the full relationship
array. This is change-impact analysis as a query, not a new model; it composes the (also planned)
richer relationship set with query/context execution.

## Future example requests and responses (illustrative only)

```text
> Find the implementation of wallet debit.
```

_Future, illustrative:_ a `SemanticQuery` with `entity: { name: "debit", kind: "method" }` would
return the matching `SemanticEntity` (or entities, if ambiguous) — today, a consumer gets the same
answer by filtering `result.entities` directly, without a query layer.

```text
> Show its direct callers and side effects.
```

_Future, illustrative:_ requires both the `calls` relationship kind (not implemented — see
[04-relationship-model.md](04-relationship-model.md)) and the Behavioral Model (not implemented —
see [05-behavior-model.md](05-behavior-model.md)). Not answerable today in any form.

```text
> Build a 5,000-token context bundle for fixing frozen-wallet debit.
```

_Future, illustrative:_ a `ContextRequest` with `task: "fixing frozen-wallet debit"`,
`tokenBudget: 5000`. No ranking, token-estimation, or bundle-assembly logic exists to answer this.

None of the three examples above can be executed against Codara today. They illustrate the shape
of a future request/response pair, not a working feature.

## What exists today instead

A consumer that needs answers to questions like these today must read `CodaraAnalysisResult`
directly and filter/traverse the flat `entities`/`relationships`/`evidence` arrays themselves — the
same way Codara's own integration tests do. This is adequate for small-to-medium results and is
exactly why the model is designed to be deterministic and fully serializable (see
[08-public-api.md](08-public-api.md)) even without a query layer on top of it yet.

---

Previous: [06 — Evidence and Confidence](06-evidence-and-confidence.md) · Next: [08 — Public API](08-public-api.md)
