import type { SourceLocation } from "./entity.js";

/**
 * The Behavioral Model is a documented seam for a later phase.
 * Phase 1 does not extract behaviors; these types exist so that
 * consumers and future adapters can anticipate the shape without
 * requiring a breaking schema change.
 */
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

export interface Condition {
  description: string;
}

export interface Effect {
  description: string;
}

export interface Outcome {
  description: string;
}

export interface SemanticBehavior {
  id: string;
  entityId: string;
  kind: BehaviorKind;
  description: string;
  preconditions: Condition[];
  effects: Effect[];
  outcome?: Outcome;
  location: SourceLocation;
  confidence: number;
  evidenceIds: string[];
}
