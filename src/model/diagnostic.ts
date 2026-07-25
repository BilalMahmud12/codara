import type { SourceLocation } from "./entity.js";

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
