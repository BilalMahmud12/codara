import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  analyzeProject,
  ENGINE_VERSION,
  SCHEMA_VERSION,
} from "../../src/application/analyze-project.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("analyzeProject / codara's own repository", () => {
  it("analyzes itself and produces a well-formed result", async () => {
    const result = await analyzeProject({ root: repoRoot, outputFile: false });

    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.engineVersion).toBe(ENGINE_VERSION);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(result.metrics.filesAnalyzed).toBeGreaterThan(10);
    expect(result.metrics.entityCountsByKind.module).toBeGreaterThan(10);
    expect(result.entities.every((entity) => !entity.location.filePath.startsWith("/"))).toBe(true);
  });
});
