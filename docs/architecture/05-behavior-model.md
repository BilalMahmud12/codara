# Behavior Model

> **Status: planned only. No behavior extraction exists in Phase 1.**
> `src/model/behavior.ts` defines the public shape below as a typed seam — reserved so a future
> phase can add behavior extraction without a breaking change to `CodaraAnalysisResult` — but no
> code in this repository populates it, and `SemanticBehavior` does not appear anywhere in
> `CodaraAnalysisResult`. Everything in this document is a design contract for later work, not a
> description of current capability.

## Why a function is not equivalent to one behavior

The [Semantic Entity Model](03-semantic-entity-model.md) treats `WalletService.debit` as a single
entity: one id, one location, one set of flags. But a real method rarely does exactly one thing —
it typically produces several distinct, independently meaningful outcomes depending on the input
and the state it encounters:

```text
Entity: WalletService.debit
    ├── Reject invalid amount
    ├── Reject missing wallet
    ├── Reject insufficient balance
    ├── Decrease balance
    ├── Persist wallet
    ├── Emit debit event
    └── Return updated wallet
```

The Behavioral Model exists to represent that finer grain: a behavior is smaller than an entity,
and one entity may be the source of many behaviors. Modeling only entities and relationships (as
Phase 1 does) tells a consumer _what a project contains and how its pieces are wired together_ —
modeling behaviors would additionally tell a consumer _what each piece can actually be observed to
do_.

## Observable outcome kinds (planned)

`BehaviorKind` is already defined in `src/model/behavior.ts`, enumerating the categories a future
extraction phase would populate:

```ts
export type BehaviorKind =
  | "returnOutcome"
  | "throwOutcome"
  | "promiseSettlement"
  | "stateMutation"
  | "dependencyInteraction"
  | "eventEmission"
  | "callbackInvocation"
  | "validationOutcome"
  | "branchOutcome"
  | "fallbackOrRetry"
  | "resourceLifecycle";
```

In plain terms, these correspond to: what a function returns, what it throws, how a promise it
returns settles, what state it reads or mutates, what dependencies it calls, what events it emits,
what callbacks it invokes, what validation it performs, what its branches decide, whether it
retries or falls back, and what resources it creates or releases.

## The planned shape

```ts
export interface SemanticBehavior {
  id: string;
  entityId: string; // the entity this behavior belongs to
  kind: BehaviorKind;
  description: string;
  preconditions: Condition[];
  effects: Effect[];
  outcome?: Outcome;
  location: SourceLocation;
  confidence: number;
  evidenceIds: string[];
}

export interface Condition {
  description: string;
}

export interface Effect {
  description: string;
}

export interface Outcome {
  description: string;
}
```

`Condition`, `Effect`, and `Outcome` are currently minimal (`{ description: string }`) — placeholder
shapes, not a finished design. A real implementation would need a much richer representation to be
useful (e.g. structured references to the state or parameter a condition inspects), but expanding
them is out of scope until behavior extraction is actually designed.

### Preconditions

What must be true about the entity's inputs or ambient state for a given behavior to occur — e.g.
"amount must be positive" as the precondition for the `validationOutcome` behavior that rejects an
invalid amount.

### Effects

What observably changes as a result of the behavior occurring — e.g. "wallet.balance decreases by
amount" as the effect of the `stateMutation` behavior inside `debit`.

### Local control-flow decomposition

Turning one entity into multiple behaviors requires walking the entity's own control flow (its
branches, its early returns, its throw sites, its awaited calls) and recognizing which shape each
path corresponds to. This is explicitly **local** — Phase 1's relationship model already draws the
line at symbol resolution and control-flow analysis (see
[04-relationship-model.md](04-relationship-model.md#planned-relationship-categories-not-implemented)),
and behavior extraction sits on the far side of that same line. No interprocedural analysis (across
function boundaries) is implied by this design; only within a single entity's own body.

### Why behaviors must carry evidence and confidence

The same invariant that governs entities and relationships today — no semantic conclusion without
traceable evidence (see [06-evidence-and-confidence.md](06-evidence-and-confidence.md)) — applies
identically to behaviors. Recognizing "this branch rejects an invalid amount" from source is
inherently more interpretive than recognizing "this is a class named `WalletService`"; behaviors
would very often carry `confidence < 1`, and every one would need to point at the source evidence
(the specific branch, throw, or call) that justified it. A behavior asserted without pointing at
the code that produced it would violate the same core invariant entities and relationships already
respect.

## What this document is not

This is not a design for test-quality assessment. A future consumer might use behaviors to reason
about what a test _could_ be protecting, but deciding whether a test _actually does_ protect a
given behavior — assertion strength, mock integrity, coverage correlation — is test-intelligence
territory, explicitly reserved for specialized applications built outside this repository (see
[00-vision.md](00-vision.md#the-engine--application-boundary)). The Behavioral Model describes what
software can be observed to do; it does not evaluate how well anything verifies that.

---

Previous: [04 — Relationship Model](04-relationship-model.md) · Next: [06 — Evidence and Confidence](06-evidence-and-confidence.md)
