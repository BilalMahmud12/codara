import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/application/analyze-project.js";
import type { SemanticEntity } from "../../src/model/entity.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function fixture(name: string): string {
  return join(fixturesDir, name);
}

function findEntity(entities: SemanticEntity[], suffix: string): SemanticEntity | undefined {
  return entities.find((entity) => entity.id.endsWith(suffix));
}

describe("analyzeProject / vanilla-js-cjs", () => {
  it("extracts CommonJS structure without a package manifest error", async () => {
    const result = await analyzeProject({ root: fixture("vanilla-js-cjs"), outputFile: false });
    expect(result.diagnostics).toEqual([]);
    expect(result.project.moduleSystem).toBe("commonjs");
    expect(findEntity(result.entities, "class:Calculator")).toBeDefined();
    expect(
      result.relationships.some(
        (relationship) =>
          relationship.kind === "contains" && relationship.targetId?.includes("Calculator"),
      ),
    ).toBe(true);
  });
});

describe("analyzeProject / vanilla-js-esm", () => {
  it("extracts ESM exports and import relationships", async () => {
    const result = await analyzeProject({ root: fixture("vanilla-js-esm"), outputFile: false });
    expect(result.project.moduleSystem).toBe("esm");

    const importsMath = result.relationships.find(
      (relationship) => relationship.kind === "imports" && relationship.sourceId === "src/index.js",
    );
    expect(importsMath?.targetId).toBe("src/math.js");

    const exportsPi = result.relationships.find(
      (relationship) =>
        relationship.kind === "exports" && relationship.targetId?.endsWith("variable:PI"),
    );
    expect(exportsPi).toBeDefined();
  });
});

describe("analyzeProject / typescript-basic", () => {
  it("extracts classes, interfaces, enums, and members with correct containment", async () => {
    const result = await analyzeProject({ root: fixture("typescript-basic"), outputFile: false });
    expect(result.project.capabilities.typeAnalysis).toBe(true);

    const walletService = findEntity(result.entities, "class:WalletService");
    expect(walletService).toBeDefined();

    const debitMethod = findEntity(result.entities, "method:debit(walletId:string,amount:number)");
    expect(debitMethod?.parentId).toBe(walletService!.id);
    expect(debitMethod?.flags.async).toBe(true);

    const getter = result.entities.find((entity) => entity.kind === "getter");
    expect(getter?.flags.visibility).toBe("public");

    const importRelationship = result.relationships.find(
      (relationship) => relationship.kind === "imports" && relationship.sourceId === "src/index.ts",
    );
    expect(importRelationship?.targetId).toBe("src/wallet.ts");
  });
});

describe("analyzeProject / typescript-path-aliases", () => {
  it("reports path-alias imports as unresolved rather than fabricating a target", async () => {
    const result = await analyzeProject({
      root: fixture("typescript-path-aliases"),
      outputFile: false,
    });
    const importRelationship = result.relationships.find(
      (relationship) => relationship.kind === "imports",
    );
    expect(importRelationship?.targetId).toBeUndefined();
    expect(importRelationship?.confidence).toBeLessThan(1);
  });
});

describe("analyzeProject / mixed-js-ts", () => {
  it("parses both .js and .ts files in the same project", async () => {
    const result = await analyzeProject({ root: fixture("mixed-js-ts"), outputFile: false });
    expect(findEntity(result.entities, "functionDeclaration:legacyGreet(name:any)")).toBeDefined();
    expect(findEntity(result.entities, "functionDeclaration:greet(name:string)")).toBeDefined();
  });
});

describe("analyzeProject / tsx-basic", () => {
  it("extracts a function component and a const-bound arrow component from a .tsx file", async () => {
    const result = await analyzeProject({ root: fixture("tsx-basic"), outputFile: false });
    const greeting = result.entities.find((entity) => entity.name === "Greeting");
    expect(greeting?.kind).toBe("functionDeclaration");

    const smallGreeting = result.entities.find((entity) => entity.name === "SmallGreeting");
    expect(smallGreeting?.kind).toBe("variable");

    const nestedArrow = result.entities.find((entity) => entity.parentId === smallGreeting?.id);
    expect(nestedArrow?.kind).toBe("arrowFunction");
  });
});

describe("analyzeProject / workspace-detection", () => {
  it("detects the workspace and reports member candidates without analyzing them", async () => {
    const result = await analyzeProject({
      root: fixture("workspace-detection"),
      outputFile: false,
    });
    expect(result.project.capabilities.workspaceDetected).toBe(true);
    expect(result.project.workspaceMemberCandidates.sort()).toEqual([
      "packages/pkg-a",
      "packages/pkg-b",
    ]);
  });
});

describe("analyzeProject / malformed-project", () => {
  it("returns partial results and diagnostics instead of throwing", async () => {
    const result = await analyzeProject({ root: fixture("malformed-project"), outputFile: false });

    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "manifest-parse-error"),
    ).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.filePath === "src/broken.ts")).toBe(
      true,
    );
    expect(result.diagnostics.some((diagnostic) => diagnostic.filePath === "tsconfig.json")).toBe(
      true,
    );

    // The well-formed sibling file is still analyzed despite the broken one.
    expect(findEntity(result.entities, "functionDeclaration:valid()")).toBeDefined();
  });
});

describe("analyzeProject determinism", () => {
  it("produces equivalent semantic output across repeated runs, excluding run metadata", async () => {
    const first = await analyzeProject({ root: fixture("typescript-basic"), outputFile: false });
    const second = await analyzeProject({ root: fixture("typescript-basic"), outputFile: false });

    const { run: _firstRun, ...firstSemantic } = first;
    const { run: _secondRun, ...secondSemantic } = second;

    expect(secondSemantic).toEqual(firstSemantic);
  });

  it("never emits absolute filesystem paths in entity locations", async () => {
    const result = await analyzeProject({ root: fixture("typescript-basic"), outputFile: false });
    for (const entity of result.entities) {
      expect(entity.location.filePath.startsWith("/")).toBe(false);
      expect(entity.location.filePath).not.toMatch(/^[A-Za-z]:\\/);
    }
  });
});
