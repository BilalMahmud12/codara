/**
 * Thrown for invocation-level failures (invalid root, unreadable path).
 * The library never calls process.exit; callers (e.g. the CLI) decide
 * how to translate this into a process exit code.
 */
export class CodaraInvocationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CodaraInvocationError";
    this.code = code;
  }
}
